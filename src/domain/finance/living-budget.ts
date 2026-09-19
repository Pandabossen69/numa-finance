import { calendarDaysBetween, formatCountSv, isSameZonedDay, zonedDayAnchorMs } from "./datetime";
import type { PayCycleProjection } from "./pay-cycle";
import { perDayBudgetMinor, remainingOpenMinor } from "./plan-months";
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

/**
 * Remaining planned bills + savings that still sit in saldo until the next
 * paycheck. Items due on/after the horizon are paid from that income.
 */
export function remainingReservedUntilHorizon(
  cycle: PayCycleProjection,
  horizonIso: string | null,
): number {
  const horizonMs = horizonIso ? Date.parse(horizonIso) : Number.POSITIVE_INFINITY;
  let reserved = 0;
  for (const { item, dueAt } of cycle.expenses) {
    const due = Date.parse(dueAt);
    if (!Number.isFinite(due)) continue;
    if (Number.isFinite(horizonMs) && due >= horizonMs) continue;
    reserved += remainingOpenMinor(item);
  }
  if (cycle.remainingSavingsMinor > 0) {
    const due = cycle.savingsDueAt ? Date.parse(cycle.savingsDueAt) : NaN;
    if (!horizonIso || !Number.isFinite(due) || due < horizonMs) {
      reserved += cycle.remainingSavingsMinor;
    }
  }
  return reserved;
}

function untilLonnSv(days: number, label: string | null): string {
  const n = Math.max(0, Math.floor(days));
  if (n <= 0) {
    return label ? `lön ${label} idag` : "nästa inkomst idag";
  }
  const count = formatCountSv(n, "dag", "dagar");
  return label ? `${count} till lön ${label}` : `${count} till nästa inkomst`;
}

function moneySv(amountMinor: number, currency: CurrencyCode): string {
  const minor = Number.isFinite(amountMinor) ? Math.round(amountMinor) : 0;
  return formatMoneyCompact(money(Math.max(0, minor), currency));
}

/**
 * Always-visible Hem lines under dagsbudget. No tap, readable in under 5s.
 * 1) Du kan leva på X / dag
 * 2) Y kvar efter planerat · Z dagar till lön [datum]
 * 3) If reserved: Saldo A − planerat B = Y
 */
export function livingBudgetHintSv(input: {
  dayBudgetMinor: number;
  poolMinor: number;
  reservedMinor: number;
  daysUntilHorizon: number;
  nextIncomeLabelSv: string | null;
  currency?: CurrencyCode;
}): string[] {
  const currency = input.currency ?? "THB";
  const day = moneySv(input.dayBudgetMinor, currency);
  const pool = moneySv(input.poolMinor, currency);
  const until = untilLonnSv(input.daysUntilHorizon, input.nextIncomeLabelSv);
  const lines = [
    `Du kan leva på ${day} / dag`,
    `${pool} kvar efter planerat · ${until}`,
  ];
  if (input.reservedMinor > 0) {
    const saldo = moneySv(input.poolMinor + input.reservedMinor, currency);
    const reserved = moneySv(input.reservedMinor, currency);
    lines.push(`Saldo ${saldo} − planerat ${reserved} = ${pool}`);
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
  const reservedUntilIncomeMinor = remainingReservedUntilHorizon(
    cycle,
    input.nextIncomeAt,
  );
  const liveOn = hasBalance
    ? bankBalanceMinor - reservedUntilIncomeMinor
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
    reservedUntilIncomeMinor,
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

  const remainingFree = cycle.freeToSpendMinor - cycleSpendingMinor;
  const spentBeforeToday = Math.max(0, cycleSpendingMinor - spentToday);
  const horizon = paycheckHorizonIso(cycle);
  const reservedUntilIncomeMinor = remainingReservedUntilHorizon(cycle, horizon);
  const hasBalance = bankBalanceMinor != null;
  const poolAtMorning = hasBalance
    ? bankBalanceMinor - reservedUntilIncomeMinor + spentToday
    : cycle.freeToSpendMinor - spentBeforeToday;
  const availableMinor = hasBalance
    ? bankBalanceMinor - reservedUntilIncomeMinor
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
    reservedUntilIncomeMinor,
    nextIncomeAt: horizon,
    nextIncomeLabelSv: paycheckHorizonLabelSv(cycle, horizon),
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}
