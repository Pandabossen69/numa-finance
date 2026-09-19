import {
  addMonthsKey,
  explicitlyLinkedPlanItemIds,
  importableFixedExpenses,
  projectCashCoverage,
  projectPlanForMonth,
  suggestPlanLinks,
  type CanonicalTransaction,
  type CashCoverageView,
  type PlanItem,
  type PlanLinkSuggestion,
  type MonthPlanProjection,
} from "@/domain/finance";

/** Hard max to visible totals + list on the soft month-switch path. */
export const PLAN_MONTH_VISIBLE_BUDGET_MS = 300;
/** Never leave Plan blank longer than this while switching months. */
export const PLAN_MONTH_BLANK_BUDGET_MS = 500;

export type PlanMonthPaintInput = {
  items: PlanItem[];
  ledgerTransactions: CanonicalTransaction[];
  monthKey: string;
  timeZone: string;
  saldoMinor: number | null;
};

/**
 * Totals + list for one calendar month. Suggestions are a separate pass so
 * a soft switch can paint Över / Kvar / rows without the O(n·m) matcher.
 */
export type PlanMonthPaint = {
  monthKey: string;
  projection: MonthPlanProjection;
  coverage: CashCoverageView;
  importableFixed: PlanItem[];
  linkedPlanIds: Set<string>;
};

export function buildPlanMonthPaint(input: PlanMonthPaintInput): PlanMonthPaint {
  const { items, ledgerTransactions, monthKey, timeZone, saldoMinor } = input;
  const projection = projectPlanForMonth(items, monthKey, timeZone);
  const coverage = projectCashCoverage({
    planItems: items,
    transactions: ledgerTransactions,
    monthKey,
    timeZone,
    saldoMinor,
  });
  const previousMonthKey = addMonthsKey(monthKey, -1);
  return {
    monthKey,
    projection,
    coverage,
    importableFixed: importableFixedExpenses({
      items,
      fromMonthKey: previousMonthKey,
      toMonthKey: monthKey,
      timeZone,
    }),
    linkedPlanIds: explicitlyLinkedPlanItemIds(ledgerTransactions),
  };
}

export function buildPlanMonthSuggestions(
  input: PlanMonthPaintInput,
  projection: MonthPlanProjection = projectPlanForMonth(
    input.items,
    input.monthKey,
    input.timeZone,
  ),
): PlanLinkSuggestion[] {
  return [
    ...suggestPlanLinks({
      items: projection.incomes,
      transactions: input.ledgerTransactions,
      kind: "income",
      monthKey: input.monthKey,
      timeZone: input.timeZone,
    }),
    ...suggestPlanLinks({
      items: projection.items,
      transactions: input.ledgerTransactions,
      kind: "expense",
      monthKey: input.monthKey,
      timeZone: input.timeZone,
    }),
  ];
}
