import { matchPlanItemPairs, type LedgerMatchTx } from "./cash-coverage";
import type { PlanItem } from "./types";

export type PlanLinkSuggestion = {
  planItemId: string;
  transactionId: string;
  kind: "income" | "expense";
  score: number;
};

/**
 * User-facing suggestions only. Never applied to Över / Kvar att betala
 * / settle flags until the user confirms.
 */
export function suggestPlanLinks(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): PlanLinkSuggestion[] {
  return matchPlanItemPairs(params).map((pair) => ({
    planItemId: pair.itemId,
    transactionId: pair.txId,
    kind: params.kind,
    score: pair.score,
  }));
}

/** Confirmed user link — never a heuristic guess or synthetic settle. */
export function explicitlyLinkedPlanItemIds(
  transactions: readonly Pick<
    LedgerMatchTx,
    "status" | "linkedPlanItemId"
  >[],
): Set<string> {
  const ids = new Set<string>();
  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    if (tx.linkedPlanItemId) ids.add(tx.linkedPlanItemId);
  }
  return ids;
}
