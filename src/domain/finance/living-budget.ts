import { calendarDaysBetween, formatCountSv, isSameZonedDay, zonedDayAnchorMs } from "./datetime";
import type { PayCycleProjection } from "./pay-cycle";
import {
  labelSavingsMonthsSv,
  monthKeyFromDate,
  perDayBudgetMinor,
  remainingOpenMinor,
} from "./plan-months";
import { isBankSmsLedgerRow } from "./balance";
import type { TransactionSource } from "./types";
import { formatMoneyCompact, money, type CurrencyCode } from "@/domain/money";

export type LivingBudgetMode = "bridge" | "cycle" | "empty";

/**
 * What you can live on right now on Hem.
 *
 * - bridge: before funding is evidenced — kontosaldo until then
 * - cycle: after funding income landed (partial or full phase from pay-cycle)
 * - empty: no planned incomes yet
 *
 * Day envelope (dagsbudget):
 * Morning sticky allowance is floor(poolWithoutTodaySpend / daysLeft).
 * The pool is cash to live on until the next paycheck: bank balance
 * minus remaining planned expenses/savings due before that horizon
 * (already-settled amounts stay in the ledger/saldo and are not
 * subtracted again). Cycle mode must not silently use plan
 * `freeToSpend` when a saldo exists — that hides reserved money.
 * `daysLeft` is calendar days until the next real planned paycheck
 * (`nextPaycheckAt`), never the later cycle-end last income.
 * Spending today depletes *today's remaining only* — it does not
 * redistribute into a lower rate for other days mid-day.
 */
export type LivingBudget = {
  mode: LivingBudgetMode;
  /** True when user must enter how much is left on the account. */
  needsAvailableInput: boolean;
  /** True when available comes from bank balance / checkpoints. */
  usesBankBalance: boolean;
  availableMinor: number;
  remainingFreeMinor: number;
  /** Inclusive spend days for dagsbudget math — never 0. */
  daysLeft: number;
  /** Calendar days until next-income / cycle-end horizon (0 = today). Display only. */
  daysUntilHorizon: number;
  /**
   * Sticky morning dagsbudget for this calendar day.
   * Does not shrink when you spend today.
   */
  dayBudgetMinor: number;
  /**
   * What is left of today's dagsbudget: dayBudget − spentToday.
   * Negative when spend exceeds the sticky morning allowance.
   * Hem shows the absolute value under "Över" when negative.
   */
  remainingTodayMinor: number;
  /**
   * Morning cash pool divided into dagsbudget (saldo − reserved + spent today).
   * This is what Hem means by «att leva på».
   */
  livingPoolMinor: number;
  /** Remaining planned expenses + savings reserved from saldo until next income. */
  reservedUntilIncomeMinor: number;
  /** Open bills in `reservedUntilIncomeMinor`. */
  reservedExpensesMinor: number;
  /** Open savings in `reservedUntilIncomeMinor`. */
  reservedSavingsMinor: number;
  /** Calendar months of reserved savings (`2026-09` or `2026-09,2026-10`). */
  reservedSavingsMonthKey: string | null;
  nextIncomeAt: string | null;
  nextIncomeLabelSv: string | null;
  cycleEndLabelSv: string | null;
  cycleEndInferred: boolean;
};

/** Signed leftover of today's sticky dagsbudget. Negative means overspent. */
export function remainingTodayOf(
  dayBudgetMinor: number,
  spentTodayMinor: number,
): number {
  return dayBudgetMinor - Math.max(0, spentTodayMinor);
}

export type ReservedUntilHorizon = {
  expensesMinor: number;
  savingsMinor: number;
  totalMinor: number;
  savingsMonthKey: string | null;
};

/**
 * Remaining planned bills + savings that still sit in saldo until the next
 * paycheck. Items due on/after the horizon are paid from that income.
 */
export function remainingReservedBreakdownUntilHorizon(
  cycle: PayCycleProjection,
  horizonIso: string | null,
  timeZone = "Asia/Bangkok",
): ReservedUntilHorizon {
  const horizonMs = horizonIso ? Date.parse(horizonIso) : Number.POSITIVE_INFINITY;
  let expensesMinor = 0;
  for (const { item, dueAt } of cycle.expenses) {
    const due = Date.parse(dueAt);
    if (!Number.isFinite(due)) continue;
    if (Number.isFinite(horizonMs) && due >= horizonMs) continue;
    expensesMinor += remainingOpenMinor(item);
  }

  let savingsMinor = 0;
  const savingsMonthKeys: string[] = [];
  const rows = cycle.remainingSavingsRows ?? [];
  if (rows.length > 0) {
    for (const row of rows) {
      const due = Date.parse(row.dueAt);
      if (!Number.isFinite(due)) continue;
      if (Number.isFinite(horizonMs) && due >= horizonMs) continue;
      savingsMinor += row.amountMinor;
      const monthKey = monthKeyFromDate(new Date(row.dueAt), timeZone);
      if (!savingsMonthKeys.includes(monthKey)) savingsMonthKeys.push(monthKey);
    }
  } else if (cycle.remainingSavingsMinor > 0) {
    const due = cycle.savingsDueAt ? Date.parse(cycle.savingsDueAt) : NaN;
    if (!horizonIso || !Number.isFinite(due) || due < horizonMs) {
      savingsMinor += cycle.remainingSavingsMinor;
      if (cycle.savingsDueAt && Number.isFinite(due)) {
        savingsMonthKeys.push(monthKeyFromDate(new Date(cycle.savingsDueAt), timeZone));
      }
    }
  }

  return {
    expensesMinor,
    savingsMinor,
    totalMinor: expensesMinor + savingsMinor,
    savingsMonthKey: savingsMonthKeys.length > 0 ? savingsMonthKeys.join(",") : null,
  };
}

export function remainingReservedUntilHorizon(
  cycle: PayCycleProjection,
  horizonIso: string | null,
  timeZone = "Asia/Bangkok",
): number {
  return remainingReservedBreakdownUntilHorizon(cycle, horizonIso, timeZone)
    .totalMinor;
}

function reservedFields(breakdown: ReservedUntilHorizon): Pick<
  LivingBudget,
  | "reservedUntilIncomeMinor"
  | "reservedExpensesMinor"
  | "reservedSavingsMinor"
  | "reservedSavingsMonthKey"
> {
  return {
    reservedUntilIncomeMinor: breakdown.totalMinor,
    reservedExpensesMinor: breakdown.expensesMinor,
    reservedSavingsMinor: breakdown.savingsMinor,
    reservedSavingsMonthKey: breakdown.savingsMonthKey,
  };
}

function untilIncomeSv(days: number, label: string | null): string {
  const n = Math.max(0, Math.floor(days));
  if (n <= 0) {
    return label ? `${label} idag` : "nästa inkomst idag";
  }
  const count = formatCountSv(n, "dag", "dagar");
  return label ? `${count} till ${label}` : `${count} till nästa inkomst`;
}

function moneySv(amountMinor: number, currency: CurrencyCode): string {
  const minor = Number.isFinite(amountMinor) ? Math.round(amountMinor) : 0;
  return formatMoneyCompact(money(Math.max(0, minor), currency));
}

function roundedMinor(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** Cookie/SSR snapshots may lack the reserved-savings split — infer safely. */
export function inferReservedSavingsMinor(input: {
  reservedMinor: number;
  reservedSavingsMinor?: number | null;
  planSavingsMinor?: number | null;
  savingsTotalMinor?: number | null;
}): number {
  if (
    input.reservedSavingsMinor != null &&
    Number.isFinite(input.reservedSavingsMinor)
  ) {
    return Math.max(0, roundedMinor(input.reservedSavingsMinor));
  }
  const reserved = Math.max(0, roundedMinor(input.reservedMinor));
  if (reserved <= 0) return 0;
  const plan = Math.max(0, roundedMinor(input.planSavingsMinor ?? 0));
  const total = Math.max(0, roundedMinor(input.savingsTotalMinor ?? 0));
  if (reserved === plan || reserved === total) return reserved;
  if (plan > 0 && reserved > plan) return Math.min(plan, reserved);
  if (total > 0 && reserved <= total) return reserved;
  return 0;
}

/**
 * True only when the displayed subtraction is arithmetically exact.
 * Morning pool is saldo − reserved + spenderat idag (0 when nothing spent).
 */
export function livingBudgetEquationHolds(input: {
  saldoMinor: number;
  reservedMinor: number;
  poolMinor: number;
  spentTodayMinor?: number;
}): boolean {
  const saldo = roundedMinor(input.saldoMinor);
  const reserved = roundedMinor(input.reservedMinor);
  const pool = roundedMinor(input.poolMinor);
  const spent = Math.max(0, roundedMinor(input.spentTodayMinor ?? 0));
  return saldo - reserved + spent === pool;
}

function sparaISv(monthLabel: string | null | undefined): string {
  const month = monthLabel?.trim();
  return month ? `Spara i ${month}` : "sparande";
}

function reservedSubtrahendSv(input: {
  reservedMinor: number;
  reservedSavingsMinor?: number | null;
  reservedExpensesMinor?: number | null;
  savingsMonthLabelSv?: string | null;
  currency: CurrencyCode;
}): string | null {
  const reserved = Math.max(0, roundedMinor(input.reservedMinor));
  if (reserved <= 0) return null;
  const savings = inferReservedSavingsMinor({
    reservedMinor: reserved,
    reservedSavingsMinor: input.reservedSavingsMinor,
  });
  const expenses = Math.max(
    0,
    input.reservedExpensesMinor != null &&
      Number.isFinite(input.reservedExpensesMinor)
      ? roundedMinor(input.reservedExpensesMinor)
      : reserved - savings,
  );
  const parts: string[] = [];
  if (savings > 0) {
    parts.push(
      `${sparaISv(input.savingsMonthLabelSv)} ${moneySv(savings, input.currency)}`,
    );
  }
  if (expenses > 0) {
    parts.push(`kvar att betala ${moneySv(expenses, input.currency)}`);
  }
  if (parts.length === 0) {
    parts.push(
      `${sparaISv(input.savingsMonthLabelSv)} ${moneySv(reserved, input.currency)}`,
    );
  }
  return parts.join(" − ");
}

/**
 * Always-visible Hem lines under dagsbudget. No tap, readable in under 5s.
 * 1) Du kan leva på X / dag
 * 2) Saldo A − sparande/Spara i [månad] B = Y · Z dagar till [datum]
 *    — only when A − B (+ spenderat idag) = Y. Never a false equation.
 */
export function livingBudgetHintSv(input: {
  dayBudgetMinor: number;
  poolMinor: number;
  reservedMinor: number;
  reservedSavingsMinor?: number | null;
  reservedExpensesMinor?: number | null;
  savingsMonthLabelSv?: string | null;
  reservedSavingsMonthKey?: string | null;
  saldoMinor?: number | null;
  spentTodayMinor?: number | null;
  daysUntilHorizon: number;
  nextIncomeLabelSv: string | null;
  currency?: CurrencyCode;
}): string[] {
  const currency = input.currency ?? "THB";
  const day = moneySv(input.dayBudgetMinor, currency);
  const pool = moneySv(input.poolMinor, currency);
  const until = untilIncomeSv(input.daysUntilHorizon, input.nextIncomeLabelSv);
  const spentTodayMinor = Math.max(0, roundedMinor(input.spentTodayMinor ?? 0));
  const saldoMinor =
    input.saldoMinor != null && Number.isFinite(input.saldoMinor)
      ? Math.max(0, roundedMinor(input.saldoMinor))
      : Math.max(0, roundedMinor(input.poolMinor)) +
        Math.max(0, roundedMinor(input.reservedMinor)) -
        spentTodayMinor;
  const reservedMinor =
    input.reservedMinor > 0
      ? Math.max(0, roundedMinor(input.reservedMinor))
      : Math.max(0, saldoMinor + spentTodayMinor - Math.max(0, roundedMinor(input.poolMinor)));
  const monthLabel =
    input.savingsMonthLabelSv?.trim() ||
    labelSavingsMonthsSv(input.reservedSavingsMonthKey) ||
    null;
  const savingsMinor = inferReservedSavingsMinor({
    reservedMinor,
    reservedSavingsMinor: input.reservedSavingsMinor,
  });
  const saldo = moneySv(saldoMinor, currency);
  const holds = livingBudgetEquationHolds({
    saldoMinor,
    reservedMinor,
    poolMinor: input.poolMinor,
    spentTodayMinor,
  });
  const subtrahend = reservedSubtrahendSv({
    reservedMinor,
    reservedSavingsMinor: savingsMinor,
    reservedExpensesMinor: input.reservedExpensesMinor,
    savingsMonthLabelSv: monthLabel,
    currency,
  });

  const lines = [`Du kan leva på ${day} / dag`];
  if (holds && subtrahend) {
    const spentBit =
      spentTodayMinor > 0
        ? ` + spenderat idag ${moneySv(spentTodayMinor, currency)}`
        : "";
    lines.push(`Saldo ${saldo} − ${subtrahend}${spentBit} = ${pool} · ${until}`);
  } else if (holds) {
    lines.push(`Saldo ${saldo} · ${until}`);
  } else {
    lines.push(`Saldo ${saldo} · Kvar i perioden ${pool} · ${until}`);
    if (savingsMinor > 0) {
      lines.push(
        `${sparaISv(monthLabel)} ${moneySv(savingsMinor, currency)} — avsatt i planen`,
      );
    } else if (reservedMinor > 0 && subtrahend) {
      lines.push(`${subtrahend} — avsatt i planen`);
    }
  }
  return lines;
}

function bridgeHorizonIso(
  cycle: PayCycleProjection,
  now: Date,
  timeZone: string,
): string | null {
  if (!cycle.startAt) return cycle.nextPaycheckAt ?? cycle.endAt;
  const startDay = zonedDayAnchorMs(cycle.startAt, timeZone);
  const todayDay = zonedDayAnchorMs(now, timeZone);
  if (
    todayDay < startDay ||
    isSameZonedDay(now, cycle.startAt, timeZone)
  ) {
    return cycle.startAt;
  }
  return cycle.nextPaycheckAt ?? cycle.endAt;
}

function paycheckHorizonIso(cycle: PayCycleProjection): string | null {
  return cycle.nextPaycheckAt ?? cycle.endAt;
}

function paycheckHorizonLabelSv(cycle: PayCycleProjection, horizon: string | null): string | null {
  if (!horizon) return null;
  if (horizon === cycle.nextPaycheckAt) return cycle.nextPaycheckLabelSv;
  if (horizon === cycle.startAt) return cycle.startLabelSv;
  if (horizon === cycle.endAt) return cycle.endLabelSv;
  return cycle.nextPaycheckLabelSv ?? cycle.endLabelSv ?? cycle.startLabelSv;
}

function projectBridge(input: {
  cycle: PayCycleProjection;
  now: Date;
  timeZone: string;
  bankBalanceMinor: number | null;
  spentToday: number;
  nextIncomeAt: string | null;
  nextIncomeLabelSv: string | null;
}): LivingBudget {
  const { cycle, now, timeZone, bankBalanceMinor, spentToday } = input;
  const hasBalance = bankBalanceMinor != null;
  const reserved = remainingReservedBreakdownUntilHorizon(
    cycle,
    input.nextIncomeAt,
    timeZone,
  );
  const liveOn = hasBalance
    ? bankBalanceMinor - reserved.totalMinor
    : 0;
  const availableMinor = hasBalance ? liveOn : 0;
  const morningAvailable = hasBalance
    ? Math.max(0, availableMinor + spentToday)
    : 0;
  const horizon = input.nextIncomeAt;
  const calendarDays = horizon
    ? calendarDaysBetween(now, horizon, timeZone)
    : 0;
  const daysUntilHorizon = Math.max(0, calendarDays);
  const daysLeft = Math.max(1, calendarDays);
  const dayBudgetMinor = perDayBudgetMinor(morningAvailable, daysLeft);
  const remainingToday = remainingTodayOf(dayBudgetMinor, spentToday);
  return {
    mode: "bridge",
    needsAvailableInput: !hasBalance,
    usesBankBalance: hasBalance,
    availableMinor,
    remainingFreeMinor: availableMinor,
    daysLeft,
    daysUntilHorizon,
    dayBudgetMinor,
    remainingTodayMinor: remainingToday,
    livingPoolMinor: morningAvailable,
    ...reservedFields(reserved),
    nextIncomeAt: input.nextIncomeAt,
    nextIncomeLabelSv: input.nextIncomeLabelSv,
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}

/**
 * Credit that proves planned funding actually landed in the ledger.
 * Bank-SMS / tip-ledger credits (PromptPay etc.) are already in tip saldo —
 * they must not flip Hem into cycle mode.
 */
export function isFundingEvidenceTransaction(tx: {
  status: string;
  direction: string;
  transactionType: string;
  occurredAt: string;
  source?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  sourceObservationId?: string | null;
}): boolean {
  if (tx.status !== "confirmed") return false;
  if (tx.direction !== "credit") return false;
  if (
    isBankSmsLedgerRow({
      source: (tx.source ?? undefined) as TransactionSource | undefined,
      fingerprint: tx.fingerprint ?? undefined,
      balanceAfterMinor: tx.balanceAfterMinor ?? undefined,
      sourceObservationId: tx.sourceObservationId ?? undefined,
    })
  ) {
    return false;
  }
  return (
    tx.transactionType === "income" || tx.transactionType === "refund"
  );
}

export function hasCycleFundingEvidence(input: {
  cycleStartAt: string | null;
  cycleEndAt: string | null;
  transactions: Array<{
    status: string;
    direction: string;
    transactionType: string;
    occurredAt: string;
    source?: string | null;
    fingerprint?: string | null;
    balanceAfterMinor?: number | null;
    sourceObservationId?: string | null;
  }>;
}): boolean {
  const startMs = input.cycleStartAt ? Date.parse(input.cycleStartAt) : NaN;
  const endMs = input.cycleEndAt ? Date.parse(input.cycleEndAt) : NaN;
  if (!Number.isFinite(startMs)) return false;

  return input.transactions.some((tx) => {
    if (!isFundingEvidenceTransaction(tx)) return false;
    const at = Date.parse(tx.occurredAt);
    if (!Number.isFinite(at) || at < startMs) return false;
    if (Number.isFinite(endMs) && at >= endMs) return false;
    return true;
  });
}

export function projectLivingBudget(input: {
  cycle: PayCycleProjection;
  now: Date;
  timeZone: string;
  /** Current account balance after checkpoint + movements, or null if unknown. */
  bankBalanceMinor: number | null;
  /** Actual spending attributed to the active cycle (ignored in bridge). */
  cycleSpendingMinor?: number;
  /** Confirmed spending on the current zoned calendar day. */
  todaySpendingMinor?: number;
  /**
   * When false, stay on bank bridge even if the calendar pay-cycle phase
   * already flipped — planned income must not inflate "available today".
   * When omitted, calendar phase alone decides (Plan preview).
   */
  fundingConfirmed?: boolean;
}): LivingBudget {
  const {
    cycle,
    now,
    timeZone,
    bankBalanceMinor,
    cycleSpendingMinor = 0,
    todaySpendingMinor = 0,
    fundingConfirmed,
  } = input;

  const spentToday = Math.max(0, todaySpendingMinor);

  if (!cycle.startAt || !cycle.endAt) {
    return {
      mode: "empty",
      needsAvailableInput: false,
      usesBankBalance: false,
      availableMinor: 0,
      remainingFreeMinor: 0,
      daysLeft: 1,
      daysUntilHorizon: 0,
      dayBudgetMinor: 0,
      remainingTodayMinor: 0,
      livingPoolMinor: 0,
      reservedUntilIncomeMinor: 0,
      reservedExpensesMinor: 0,
      reservedSavingsMinor: 0,
      reservedSavingsMonthKey: null,
      nextIncomeAt: null,
      nextIncomeLabelSv: null,
      cycleEndLabelSv: null,
      cycleEndInferred: false,
    };
  }

  const todayMs = zonedDayAnchorMs(now, timeZone);
  const startMs = Date.parse(cycle.startAt);
  const endMs = Date.parse(cycle.endAt);
  const cycleClosed =
    !cycle.isActive || (Number.isFinite(endMs) && todayMs >= endMs);
  const calendarWaiting =
    cycle.phase === "pre" ||
    (!cycle.isActive && Number.isFinite(startMs) && todayMs < startMs);
  const waitingForBankEvidence =
    fundingConfirmed === false && !cycleClosed && cycle.phase !== "pre";

  // Bridge: before first paycheck, after cycle end, or payday without bank proof.
  if (calendarWaiting || cycleClosed || waitingForBankEvidence) {
    const horizon = bridgeHorizonIso(cycle, now, timeZone);
    return projectBridge({
      cycle,
      now,
      timeZone,
      bankBalanceMinor,
      spentToday,
      nextIncomeAt: horizon,
      nextIncomeLabelSv: paycheckHorizonLabelSv(cycle, horizon),
    });
  }

  const spentBeforeToday = Math.max(0, cycleSpendingMinor - spentToday);
  const horizon = paycheckHorizonIso(cycle);
  const reserved = remainingReservedBreakdownUntilHorizon(
    cycle,
    horizon,
    timeZone,
  );
  // Spec L leftover is income − bills − savings already in freeToSpend.
  // Partial-phase pay-cycle zeros savingsMinor, so extra open avsätt never
  // left the living pool — Över moved, Kvar/dagsbudget stayed put.
  const extraSparMinor = Math.max(0, reserved.savingsMinor - cycle.savingsMinor);
  const leftoverMinor = cycle.freeToSpendMinor - extraSparMinor;
  const remainingFree = leftoverMinor - cycleSpendingMinor;
  const hasBalance = bankBalanceMinor != null;
  const planPoolAtMorning = leftoverMinor - spentBeforeToday;
  const cashPoolAtMorning = hasBalance
    ? bankBalanceMinor - reserved.totalMinor + spentToday
    : null;
  // Never hide a prod-like plan leftover behind an over-reserved cash pool.
  const poolAtMorning =
    cashPoolAtMorning != null && cashPoolAtMorning > 0
      ? cashPoolAtMorning
      : planPoolAtMorning;
  const availableMinor =
    cashPoolAtMorning != null && cashPoolAtMorning > 0
      ? bankBalanceMinor! - reserved.totalMinor
      : remainingFree;
  const calendarDays = horizon
    ? calendarDaysBetween(now, horizon, timeZone)
    : 0;
  const daysUntilHorizon = Math.max(0, calendarDays);
  const daysLeft = Math.max(1, calendarDays);
  const dayBudgetMinor = perDayBudgetMinor(Math.max(0, poolAtMorning), daysLeft);
  const remainingToday = remainingTodayOf(dayBudgetMinor, spentToday);

  return {
    mode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: hasBalance,
    availableMinor,
    remainingFreeMinor: remainingFree,
    daysLeft,
    daysUntilHorizon,
    dayBudgetMinor,
    remainingTodayMinor: remainingToday,
    livingPoolMinor: Math.max(0, poolAtMorning),
    ...reservedFields(reserved),
    nextIncomeAt: horizon,
    nextIncomeLabelSv: paycheckHorizonLabelSv(cycle, horizon),
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}
