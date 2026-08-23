import { calendarDaysBetween, zonedDayAnchorMs } from "./datetime";
import type { PayCycleProjection } from "./pay-cycle";
import { perDayBudgetMinor } from "./plan-months";
import { isBankSmsLedgerRow } from "./balance";
import type { TransactionSource } from "./types";

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
  daysLeft: number;
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

function bridgeHorizonIso(
  cycle: PayCycleProjection,
  todayMs: number,
): string | null {
  const startMs = cycle.startAt ? Date.parse(cycle.startAt) : NaN;
  if (Number.isFinite(startMs) && todayMs < startMs) return cycle.startAt;
  return cycle.endAt;
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
  const availableMinor = hasBalance ? Math.max(0, bankBalanceMinor) : 0;
  const morningAvailable = hasBalance
    ? Math.max(0, availableMinor + spentToday)
    : 0;
  const horizon = input.nextIncomeAt;
  const daysLeft = horizon
    ? Math.max(1, calendarDaysBetween(now, horizon, timeZone))
    : 1;
  const dayBudgetMinor = perDayBudgetMinor(morningAvailable, daysLeft);
  const remainingToday = remainingTodayOf(dayBudgetMinor, spentToday);
  return {
    mode: "bridge",
    needsAvailableInput: !hasBalance,
    usesBankBalance: hasBalance,
    availableMinor,
    remainingFreeMinor: availableMinor,
    daysLeft,
    dayBudgetMinor,
    remainingTodayMinor: remainingToday,
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
      dayBudgetMinor: 0,
      remainingTodayMinor: 0,
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
    const horizon = bridgeHorizonIso(cycle, todayMs);
    return projectBridge({
      cycle,
      now,
      timeZone,
      bankBalanceMinor,
      spentToday,
      nextIncomeAt: horizon,
      nextIncomeLabelSv:
        horizon === cycle.startAt ? cycle.startLabelSv : cycle.endLabelSv,
    });
  }

  const remainingFree = cycle.freeToSpendMinor - cycleSpendingMinor;
  const spentBeforeToday = Math.max(0, cycleSpendingMinor - spentToday);
  const poolAtMorning = cycle.freeToSpendMinor - spentBeforeToday;
  const daysLeft = Math.max(
    1,
    calendarDaysBetween(now, cycle.endAt, timeZone),
  );
  const dayBudgetMinor = perDayBudgetMinor(poolAtMorning, daysLeft);
  const remainingToday = remainingTodayOf(dayBudgetMinor, spentToday);

  return {
    mode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    availableMinor: remainingFree,
    remainingFreeMinor: remainingFree,
    daysLeft,
    dayBudgetMinor,
    remainingTodayMinor: remainingToday,
    nextIncomeAt: cycle.endAt,
    nextIncomeLabelSv: cycle.endLabelSv,
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}
