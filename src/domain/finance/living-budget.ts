import type { PayCycleProjection } from "./pay-cycle";
import { perDayBudgetMinor } from "./plan-months";

export type LivingBudgetMode = "bridge" | "cycle" | "empty";

/**
 * What you can live on right now on Hem.
 *
 * - bridge: before next income wave arrives — use kontosaldo (manual or from
 *   fotade SMS/kvitton). Planens augusti-intäkter räknas inte förrän de kommit.
 * - cycle: after income landed — plan pool minus utgifter minus spenderat.
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

function startOfZonedDayMs(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return now.getTime();
  return Date.parse(`${y}-${m}-${d}T12:00:00.000Z`);
}

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

  const todayMs = startOfZonedDayMs(now, timeZone);
  const startMs = Date.parse(cycle.startAt);
  const endMs = Date.parse(cycle.endAt);

  // Waiting for the next paycheck wave — live on what's already on the account.
  if (Number.isFinite(startMs) && todayMs < startMs) {
    const hasBalance = bankBalanceMinor != null;
    const availableMinor = hasBalance ? Math.max(0, bankBalanceMinor) : 0;
    const daysLeft = Math.max(
      1,
      Math.ceil((startMs - todayMs) / (24 * 60 * 60 * 1000)),
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
  const fromMs =
    Number.isFinite(endMs) && todayMs < endMs ? todayMs : startMs;
  const daysLeft = Math.max(
    1,
    Math.ceil((endMs - fromMs) / (24 * 60 * 60 * 1000)),
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
