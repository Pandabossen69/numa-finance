import {
  addMonthsKey,
  cashOverMinor,
  explicitlyLinkedPlanItemIds,
  importableFixedExpenses,
  labelMonthSv,
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

/** Nav / month-key chrome only — no ledger scan, no coverage project. */
export function buildPlanMonthChrome(
  monthKey: string,
  saldoMinor: number | null,
): PlanMonthPaint {
  return {
    monthKey,
    projection: {
      monthKey,
      labelSv: labelMonthSv(monthKey),
      items: [],
      fixedItems: [],
      extraItems: [],
      incomes: [],
      savings: null,
      reservedMinor: 0,
      bufferMinor: 0,
      flexibleMinor: 0,
      incomeMinor: 0,
      savingsMinor: 0,
      fixedMinor: 0,
      extraMinor: 0,
      freeToSpendMinor: 0,
      totalPlannedMinor: 0,
    },
    coverage: {
      monthKey,
      saldoMinor,
      incomingMinor: 0,
      unpaidMinor: 0,
      savingsThisMonthMinor: 0,
      savingsPriorMinor: 0,
      reservedSavingsMinor: 0,
      overMinor: cashOverMinor({
        saldoMinor,
        incomingMinor: 0,
        unpaidMinor: 0,
      }),
    },
    importableFixed: [],
    linkedPlanIds: new Set(),
  };
}

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
