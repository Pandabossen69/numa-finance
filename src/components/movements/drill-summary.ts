import type { MovementsFilter, MovementsPeriod } from "@/features/home/last-snapshot";

type SummaryRow = {
  transactionType: string;
  direction: "debit" | "credit";
  amountMinor: number;
};

export type DrillListSummary = {
  /** «Övrigt i perioden» — the category and the drill's period. */
  label: string;
  /**
   * Expense drills show the positive spend of the visible rows
   * (debits minus credits). That is the negation of the signed list sum,
   * so the card matches the rows underneath.
   */
  amountMinor: number;
  count: number;
  expenseOnly: boolean;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

/**
 * Totals for the rows Rörelser is actually showing during an Analys drill.
 * Callers pass the already filtered list — this does not re-window the ledger.
 */
export function drillSummaryFromRows(
  rows: readonly SummaryRow[],
  opts: {
    category: string;
    period: MovementsPeriod;
    filter: MovementsFilter;
  },
): DrillListSummary {
  let signedMinor = 0;
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const tx of rows) {
    signedMinor += tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
    if (tx.transactionType === "expense" && tx.direction === "debit") {
      expenseMinor += tx.amountMinor;
    } else if (tx.transactionType === "income" && tx.direction === "credit") {
      incomeMinor += tx.amountMinor;
    }
  }
  const expenseOnly = opts.filter === "expense";
  const name = opts.category.trim() || "Utgifter";
  const place =
    opts.period === "cycle" ? "i perioden" : opts.period === "month" ? "i månaden" : null;
  return {
    label: place ? `${name} ${place}` : name,
    amountMinor: expenseOnly ? -signedMinor : signedMinor,
    count: rows.length,
    expenseOnly,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
  };
}
