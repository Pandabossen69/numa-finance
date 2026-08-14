import { calendarDaysBetween, zonedDayAnchorMs } from "./datetime";
import type { PayCycleProjection } from "./pay-cycle";
import { perDayBudgetMinor } from "./plan-months";

export type LivingBudgetMode = "bridge" | "cycle" | "empty";

/**
 * What you can live on right now on Hem.
 *
 * - bridge: before the first income of the wave — kontosaldo until then
 * - cycle: after any funding income landed (partial or full phase from pay-cycle)
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
   * What is left of today's dagsbudget: max(0, dayBudget − spentToday).
   * This is the Hem hero number.
   */
  perDayMinor: number;
  nextIncomeAt: string | null;
  nextIncomeLabelSv: string | null;
  cycleEndLabelSv: string | null;
  cycleEndInferred: boolean;
};

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
}): LivingBudget {
  const {
    cycle,
    now,
    timeZone,
    bankBalanceMinor,
    cycleSpendingMinor = 0,
    todaySpendingMinor = 0,
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
      perDayMinor: 0,
      nextIncomeAt: null,
      nextIncomeLabelSv: null,
      cycleEndLabelSv: null,
      cycleEndInferred: false,
    };
  }

  const todayMs = zonedDayAnchorMs(now, timeZone);
  const startMs = Date.parse(cycle.startAt);
  const endMs = Date.parse(cycle.endAt);

  // Waiting for the first paycheck of the wave — live on kontosaldo.
  if (
    cycle.phase === "pre" ||
    (!cycle.isActive && Number.isFinite(startMs) && todayMs < startMs)
  ) {
    const hasBalance = bankBalanceMinor != null;
    const availableMinor = hasBalance ? Math.max(0, bankBalanceMinor) : 0;
    // Balance already includes today's spends → restore morning pool.
    const morningAvailable = hasBalance
      ? Math.max(0, availableMinor + spentToday)
      : 0;
    const daysLeft = Math.max(
      1,
      calendarDaysBetween(now, cycle.startAt, timeZone),
    );
    const dayBudgetMinor = perDayBudgetMinor(morningAvailable, daysLeft);
    const remainingToday = Math.max(0, dayBudgetMinor - spentToday);
    return {
      mode: "bridge",
      needsAvailableInput: !hasBalance,
      usesBankBalance: hasBalance,
      availableMinor,
      remainingFreeMinor: availableMinor,
      daysLeft,
      dayBudgetMinor,
      perDayMinor: remainingToday,
      nextIncomeAt: cycle.startAt,
      nextIncomeLabelSv: cycle.startLabelSv,
      cycleEndLabelSv: cycle.endLabelSv,
      cycleEndInferred: cycle.endInferred,
    };
  }

  const remainingFree = cycle.freeToSpendMinor - cycleSpendingMinor;
  const spentBeforeToday = Math.max(0, cycleSpendingMinor - spentToday);
  const poolAtMorning = cycle.freeToSpendMinor - spentBeforeToday;
  const from =
    Number.isFinite(endMs) && todayMs < endMs ? now : cycle.startAt;
  const daysLeft = Math.max(
    1,
    calendarDaysBetween(from, cycle.endAt, timeZone),
  );
  const dayBudgetMinor = perDayBudgetMinor(poolAtMorning, daysLeft);
  const remainingToday = Math.max(0, dayBudgetMinor - spentToday);

  return {
    mode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    availableMinor: remainingFree,
    remainingFreeMinor: remainingFree,
    daysLeft,
    dayBudgetMinor,
    perDayMinor: remainingToday,
    nextIncomeAt: cycle.endAt,
    nextIncomeLabelSv: cycle.endLabelSv,
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}
