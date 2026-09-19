import {
  projectCashCoverage,
  projectLivingBudget,
  projectPayCycle,
  type CanonicalTransaction,
  type PlanItem,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { applyMonthSavings } from "@/features/plan/optimistic";

export type MonthSavingsPreview = {
  overMinor: number;
  remainingFreeMinor: number;
  dayBudgetMinor: number;
};

/** Draft avsättning → Över / Kvar / dagsbudget, same functions as the write path. */
export function previewMonthSavings(input: {
  items: PlanItem[];
  monthKey: string;
  draftMinor: number;
  currentMinor: number;
  currency: CurrencyCode;
  timeZone: string;
  ledgerTransactions: CanonicalTransaction[];
  saldoMinor: number | null;
  cycleSpendingMinor: number;
  todaySpendingMinor: number;
  fundingConfirmed?: boolean;
  now?: Date;
}): MonthSavingsPreview | null {
  if (input.draftMinor === input.currentMinor) return null;
  const applied = applyMonthSavings(
    input.items,
    input.monthKey,
    input.draftMinor,
    input.currency,
    input.timeZone,
  );
  const coverage = projectCashCoverage({
    planItems: applied.items,
    transactions: input.ledgerTransactions,
    monthKey: input.monthKey,
    timeZone: input.timeZone,
    saldoMinor: input.saldoMinor,
  });
  const now = input.now ?? new Date();
  const cycle = projectPayCycle(applied.items, now, input.timeZone);
  const living = projectLivingBudget({
    cycle,
    now,
    timeZone: input.timeZone,
    bankBalanceMinor: input.saldoMinor,
    cycleSpendingMinor: input.cycleSpendingMinor,
    todaySpendingMinor: input.todaySpendingMinor,
    fundingConfirmed: input.fundingConfirmed,
  });
  return {
    overMinor: coverage.overMinor,
    remainingFreeMinor: living.remainingFreeMinor,
    dayBudgetMinor: living.dayBudgetMinor,
  };
}
