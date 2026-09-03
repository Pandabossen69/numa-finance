import type { CanonicalTransaction, PlanItem } from "./types";

/**
 * Monotonic-ish content token for Hem / Plan / Analys.
 * Equal revision ⇒ same financial truth. Different ⇒ must not mix figures.
 */
export function computeFinanceRevision(input: {
  planItems: readonly PlanItem[];
  ledgerTransactions: readonly Pick<
    CanonicalTransaction,
    "id" | "updatedAt" | "amountMinor"
  >[];
  calculatedBalanceMinor: number | null;
  cycleSpendingMinor: number;
  todaySpendingMinor: number;
}): string {
  let planStamp = `${input.planItems.length}`;
  let planUpdated = "";
  for (const item of input.planItems) {
    const updated = item.updatedAt ?? item.createdAt ?? "";
    if (updated > planUpdated) planUpdated = updated;
    planStamp += `|${item.id}:${item.amountMinor}:${item.settledMinor ?? 0}:${item.settledAt ?? ""}:${updated}`;
  }

  let ledgerStamp = `${input.ledgerTransactions.length}`;
  let ledgerUpdated = "";
  for (const tx of input.ledgerTransactions) {
    const updated = tx.updatedAt ?? "";
    if (updated > ledgerUpdated) ledgerUpdated = updated;
    ledgerStamp += `|${tx.id}:${tx.amountMinor}`;
  }

  const newest = planUpdated > ledgerUpdated ? planUpdated : ledgerUpdated;
  return [
    newest || "0",
    String(input.calculatedBalanceMinor ?? "null"),
    String(input.cycleSpendingMinor),
    String(input.todaySpendingMinor),
    planStamp,
    ledgerStamp,
  ].join("::");
}

export type FinanceTruthStatus = "verified" | "stale" | "unavailable";

export type FinanceTruthMeta = {
  financeRevision: string;
  /** ISO time when this snapshot was verified from authoritative reads. */
  verifiedAt: string;
  truthStatus: FinanceTruthStatus;
};
