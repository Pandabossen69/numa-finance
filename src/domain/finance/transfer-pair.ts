/**
 * Resolve which transaction ids must be voided together for a transfer /
 * cash_withdrawal. Prefers transfer_group_id; falls back to matching the
 * opposite leg for legacy rows written before that column existed.
 */
export type TransferPairHints = {
  id: string;
  transactionType: string;
  accountId: string;
  counterAccountId: string | null;
  amountMinor: number;
  occurredAt: string;
  transferGroupId: string | null;
  status: string;
};

export function isPairedMoneyMove(transactionType: string): boolean {
  return (
    transactionType === "transfer" || transactionType === "cash_withdrawal"
  );
}

export function collectPairedVoidIds(
  target: TransferPairHints,
  siblings: TransferPairHints[],
): string[] {
  const ids = new Set<string>([target.id]);
  if (!isPairedMoneyMove(target.transactionType)) {
    return [...ids];
  }

  if (target.transferGroupId) {
    for (const row of siblings) {
      if (
        row.transferGroupId === target.transferGroupId &&
        row.status !== "voided"
      ) {
        ids.add(row.id);
      }
    }
    return [...ids];
  }

  if (!target.counterAccountId) return [...ids];

  for (const row of siblings) {
    if (row.status === "voided") continue;
    if (row.transactionType !== target.transactionType) continue;
    if (row.amountMinor !== target.amountMinor) continue;
    if (row.occurredAt !== target.occurredAt) continue;
    if (row.accountId !== target.counterAccountId) continue;
    if (row.counterAccountId !== target.accountId) continue;
    ids.add(row.id);
  }

  return [...ids];
}
