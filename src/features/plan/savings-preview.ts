import {
  applyLeftoverSparDelta,
  hasCycleFundingEvidence,
  projectCashCoverage,
  projectLivingBudget,
  projectPayCycle,
  type CanonicalTransaction,
  type PlanItem,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { formatPlanFigure } from "@/components/plan/plan-format";
import { applyMonthSavings } from "@/features/plan/optimistic";

export type MonthSavingsPreview = {
  overFrom: number;
  overTo: number;
  remainingTodayFrom: number;
  remainingTodayTo: number;
  remainingFreeFrom: number;
  remainingFreeTo: number;
  dayBudgetFrom: number;
  dayBudgetTo: number;
};

type PreviewLiving = {
  overMinor: number;
  remainingTodayMinor: number;
  remainingFreeMinor: number;
  dayBudgetMinor: number;
  livingPoolMinor: number;
  daysLeft: number;
};

/** Draft avsättning → Över / Kvar idag / dagsbudget, same functions as the write path. */
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
  const now = input.now ?? new Date();
  const applied = applyMonthSavings(
    input.items,
    input.monthKey,
    input.draftMinor,
    input.currency,
    input.timeZone,
  );
  const from = livingAfterItems(input.items, input, now);
  const to = livingAfterItems(applied.items, input, now);
  const sparDelta = input.draftMinor - input.currentMinor;
  // Leftover path: Över moves via coverage, Spec L leftover ignores unpriced
  // remaining. Apply only the spar increment so 15k stays 275,12 and 20k drops.
  // Decrease / nollställ must keep leftover `to` (275,12) — a negative
  // delta on an already-restored leftover becomes 1 108,45.
  const leftoverStuck =
    from.dayBudgetMinor === to.dayBudgetMinor &&
    from.remainingTodayMinor === to.remainingTodayMinor;
  const adjusted =
    leftoverStuck && sparDelta > 0
      ? applyLeftoverSparDelta(
          {
            livingPoolMinor: to.livingPoolMinor,
            remainingFreeMinor: to.remainingFreeMinor,
            daysLeft: to.daysLeft,
            spentTodayMinor: input.todaySpendingMinor,
          },
          sparDelta,
        )
      : to;
  return {
    overFrom: from.overMinor,
    overTo: to.overMinor,
    remainingTodayFrom: from.remainingTodayMinor,
    remainingTodayTo: adjusted.remainingTodayMinor,
    remainingFreeFrom: from.remainingFreeMinor,
    remainingFreeTo: adjusted.remainingFreeMinor,
    dayBudgetFrom: from.dayBudgetMinor,
    dayBudgetTo: adjusted.dayBudgetMinor,
  };
}

/** Always-visible Hem-facing preview — Över, Kvar idag, dagsbudget, plus Kvar i perioden. */
export function savingsPreviewLineSv(preview: MonthSavingsPreview): string {
  return [
    `Över ${formatPlanFigure(preview.overFrom)} → ${formatPlanFigure(preview.overTo)}`,
    `Kvar idag ${formatPlanFigure(preview.remainingTodayFrom)} → ${formatPlanFigure(preview.remainingTodayTo)}`,
    `Dagsbudget ${formatPlanFigure(preview.dayBudgetFrom)} → ${formatPlanFigure(preview.dayBudgetTo)}`,
    `Kvar i perioden ${formatPlanFigure(preview.remainingFreeFrom)} → ${formatPlanFigure(preview.remainingFreeTo)}`,
  ].join(" · ");
}

function livingAfterItems(
  items: PlanItem[],
  input: {
    monthKey: string;
    timeZone: string;
    ledgerTransactions: CanonicalTransaction[];
    saldoMinor: number | null;
    cycleSpendingMinor: number;
    todaySpendingMinor: number;
    fundingConfirmed?: boolean;
  },
  now: Date,
): PreviewLiving {
  const cycle = projectPayCycle(items, now, input.timeZone);
  const evidence = hasCycleFundingEvidence({
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
    transactions: input.ledgerTransactions,
  });
  const fundingConfirmed =
    input.fundingConfirmed === true
      ? true
      : input.fundingConfirmed === false
        ? evidence
        : evidence || undefined;
  const coverage = projectCashCoverage({
    planItems: items,
    transactions: input.ledgerTransactions,
    monthKey: input.monthKey,
    timeZone: input.timeZone,
    saldoMinor: input.saldoMinor,
  });
  const living = projectLivingBudget({
    cycle,
    now,
    timeZone: input.timeZone,
    bankBalanceMinor: input.saldoMinor,
    cycleSpendingMinor: input.cycleSpendingMinor,
    todaySpendingMinor: input.todaySpendingMinor,
    fundingConfirmed,
  });
  return {
    overMinor: coverage.overMinor,
    remainingTodayMinor: living.remainingTodayMinor,
    remainingFreeMinor: living.remainingFreeMinor,
    dayBudgetMinor: living.dayBudgetMinor,
    livingPoolMinor: living.livingPoolMinor,
    daysLeft: living.daysLeft,
  };
}
