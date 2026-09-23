import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";

const INCOME_LABEL = "Inkomst";

/**
 * Senaste meta label. Every row shows a category string: the saved name,
 * otherwise «Inkomst» for income (Spec U) and «Övrigt» for an expense or
 * any other non-income row. Title, date, and amount stay on the caller.
 */
export function senasteRowCategoryLabel(tx: {
  category?: string | null;
  transactionType?: string | null;
  direction?: string | null;
}): string {
  const name = tx.category?.trim();
  if (name) return name;
  if (isSenasteIncome(tx)) return INCOME_LABEL;
  return UNCATEGORISED_SPEND_NAME;
}

/** Spec U: explicit income, or a credit that is not a non-income type. */
function isSenasteIncome(tx: {
  transactionType?: string | null;
  direction?: string | null;
}): boolean {
  if (tx.transactionType === "income") return true;
  if (tx.transactionType === "expense") return false;
  return (
    tx.direction === "credit" &&
    tx.transactionType !== "transfer" &&
    tx.transactionType !== "refund" &&
    tx.transactionType !== "cash_withdrawal"
  );
}
