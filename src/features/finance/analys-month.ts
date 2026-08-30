import {
  cumulativePlanSavingsMinor,
  dayOfMonthFromIso,
  extraSaldoHintSv,
  formatListDateSv,
  isRecurringMonthly,
  labelDayOfMonthSv,
  monthLeftoverHintSv,
  monthLivingSaldoMinor,
  planRowHeroMinor,
  planRowView,
  planWealthTotalMinor,
  projectExtraSaldo,
  projectPlanForMonth,
  remainingOpenMinor,
  settledAmountMinor,
  type PlanItem,
  type PlanListStatus,
} from "@/domain/finance";

export type AnalysLine = {
  id: string;
  name: string;
  /** The same figure Plan shows: what is left when a row is Delvis klar. */
  amountMinor: number;
  detail: string;
  /** Straight from the user's taps on Plan — never from a ledger match. */
  status: PlanListStatus;
  /** Full planned amount, so Delvis can show 51 000 − 22 000 = 29 000. */
  plannedMinor: number;
  settledMinor: number;
  /** What this row still adds to Kommer in / Kvar att betala. 0 once done. */
  remainingMinor: number;
};

export type AnalysMonthView = {
  incomeMinor: number;
  expenseMinor: number;
  savingsMinor: number;
  freeToSpendMinor: number;
  extraSaldoMinor: number;
  extraSaldoDrawnMinor: number;
  extraSaldoHint: string | null;
  extraCarriedInMinor: number;
  /** Calendar-month leftover vs plan (not cash). Analys only — Plan/Hem use Över. */
  livingSaldoMinor: number;
  savingsTotalMinor: number;
  wealthTotalMinor: number;
  monthLeftoverHint: string | null;
  monthResultMinor: number;
  spentMinor: number;
  incomes: AnalysLine[];
  expenses: AnalysLine[];
};

export function labelIncomeDate(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return formatListDateSv(iso, timeZone);
}

/**
 * One plan row, described the way Plan describes it.
 *
 * Analys used to read `item.amountMinor` straight, so a row marked Delvis or
 * Betald looked untouched here while Plan showed it settled. Both screens now
 * go through planRowView / planRowHeroMinor, so they cannot disagree.
 */
export function toAnalysLine(
  item: PlanItem,
  options: { id?: string; detail: string },
): AnalysLine {
  return {
    id: options.id ?? item.id,
    name: item.name,
    amountMinor: planRowHeroMinor(item),
    detail: options.detail,
    status: planRowView(item).status,
    plannedMinor: item.amountMinor,
    settledMinor: settledAmountMinor(item),
    remainingMinor: remainingOpenMinor(item),
  };
}

/**
 * Everything the Månad tab shows, for any month.
 *
 * Pure, so the server can render the first month and the client can browse to
 * another one without a round-trip — and both get identical numbers.
 */
export function buildAnalysMonth(input: {
  planItems: PlanItem[];
  spendingByMonthKey: Record<string, number>;
  monthKey: string;
  currentMonthKey: string;
  timeZone: string;
}): AnalysMonthView {
  const { planItems, spendingByMonthKey, monthKey, currentMonthKey, timeZone } =
    input;

  const month = projectPlanForMonth(planItems, monthKey, timeZone);
  const extra = projectExtraSaldo({
    planItems,
    spendingByMonthKey,
    monthKey,
    currentMonthKey,
    timeZone,
  });
  const livingSaldoMinor = monthLivingSaldoMinor(extra);
  const savingsTotalMinor = cumulativePlanSavingsMinor(
    planItems,
    monthKey,
    timeZone,
  );

  return {
    incomeMinor: month.incomeMinor,
    expenseMinor: month.totalPlannedMinor,
    savingsMinor: month.savingsMinor,
    freeToSpendMinor: month.freeToSpendMinor,
    extraSaldoMinor: extra.extraSaldoMinor,
    extraSaldoDrawnMinor: extra.drawnMinor,
    extraSaldoHint: extraSaldoHintSv(extra, currentMonthKey) ?? null,
    extraCarriedInMinor: extra.carriedInMinor,
    livingSaldoMinor,
    savingsTotalMinor,
    wealthTotalMinor: planWealthTotalMinor(livingSaldoMinor, savingsTotalMinor),
    monthLeftoverHint: monthLeftoverHintSv(extra, currentMonthKey) ?? null,
    monthResultMinor: extra.monthResultMinor,
    spentMinor: extra.spentMinor,
    incomes: month.incomes.map((i) =>
      toAnalysLine(i, { detail: labelIncomeDate(i.nextDueAt, timeZone) }),
    ),
    expenses: month.items.map((item) =>
      toAnalysLine(item, {
        detail: isRecurringMonthly(item)
          ? item.nextDueAt != null
            ? `Varje månad · ${labelDayOfMonthSv(dayOfMonthFromIso(item.nextDueAt))}`
            : "Varje månad"
          : item.nextDueAt != null
            ? `Engång · ${labelIncomeDate(item.nextDueAt, timeZone)}`
            : "Engång",
      }),
    ),
  };
}
