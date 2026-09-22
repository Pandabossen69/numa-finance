/**
 * Senaste meta label. Expenses already carry a category («Övrigt» when
 * uncategorised). Income often has none — never leave that slot blank.
 */
export function senasteRowCategoryLabel(tx: {
  category?: string | null;
  transactionType?: string | null;
  direction?: string | null;
}): string | null {
  const name = tx.category?.trim();
  if (name) return name;
  if (tx.transactionType === "income") return "Inkomst";
  if (
    tx.direction === "credit" &&
    tx.transactionType !== "expense" &&
    tx.transactionType !== "transfer" &&
    tx.transactionType !== "refund" &&
    tx.transactionType !== "cash_withdrawal"
  ) {
    return "Inkomst";
  }
  return null;
}
