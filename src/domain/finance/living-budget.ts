import { calendarDaysBetween, zonedDayAnchorMs } from "./datetime";
import type { PayCycleProjection } from "./pay-cycle";
import { perDayBudgetMinor } from "./plan-months";

export type LivingBudgetMode = "bridge" | "cycle" | "empty";

/**
 * What you can live on right now on Hem.
 *
 * - bridge: before the last funding income arrives — use kontosaldo (manual or
 *   from fotade SMS/kvitton). The cycle opens on the last income of the wave.
 * - cycle: after last funding income landed — plan pool minus utgifter minus spenderat.
 * - empty: no planned incomes yet.
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
}): LivingBudget {
  const {
    cycle,
    now,
    timeZone,
    bankBalanceMinor,
    cycleSpendingMinor = 0,
  } = input;

  if (!cycle.startAt || !cycle.endAt) {
    return {
      mode: "empty",
      needsAvailableInput: false,
      usesBankBalance: false,
      availableMinor: 0,
      remainingFreeMinor: 0,
      daysLeft: 1,
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

  // Waiting for the next paycheck wave — live on what's already on the account.
  if (Number.isFinite(startMs) && todayMs < startMs) {
    const hasBalance = bankBalanceMinor != null;
    const availableMinor = hasBalance ? Math.max(0, bankBalanceMinor) : 0;
    const daysLeft = Math.max(
      1,
      calendarDaysBetween(now, cycle.startAt, timeZone),
    );
    return {
      mode: "bridge",
      needsAvailableInput: !hasBalance,
      usesBankBalance: hasBalance,
      availableMinor,
      remainingFreeMinor: availableMinor,
      daysLeft,
      perDayMinor: perDayBudgetMinor(availableMinor, daysLeft),
      nextIncomeAt: cycle.startAt,
      nextIncomeLabelSv: cycle.startLabelSv,
      cycleEndLabelSv: cycle.endLabelSv,
      cycleEndInferred: cycle.endInferred,
    };
  }

  const free = cycle.freeToSpendMinor - cycleSpendingMinor;
  const from =
    Number.isFinite(endMs) && todayMs < endMs ? now : cycle.startAt;
  const daysLeft = Math.max(
    1,
    calendarDaysBetween(from, cycle.endAt, timeZone),
  );

  return {
    mode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    availableMinor: free,
    remainingFreeMinor: free,
    daysLeft,
    perDayMinor: perDayBudgetMinor(free, daysLeft),
    nextIncomeAt: cycle.endAt,
    nextIncomeLabelSv: cycle.endLabelSv,
    cycleEndLabelSv: cycle.endLabelSv,
    cycleEndInferred: cycle.endInferred,
  };
}
