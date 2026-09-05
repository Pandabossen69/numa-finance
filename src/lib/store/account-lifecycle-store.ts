import {
  accountHasLedgerHistory,
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
  type Account,
  type AccountLifecycleFacts,
  type BalanceCheckpoint,
  type CanonicalTransaction,
} from "@/domain/finance";

export function accountLifecycleFacts(input: {
  account: Account;
  actorUserId: string;
  activeCount: number;
  transactions: CanonicalTransaction[];
  checkpoint: BalanceCheckpoint | null;
}): AccountLifecycleFacts {
  const after = filterTransactionsAfterCheckpoint(
    input.transactions.filter((tx) => tx.status !== "voided"),
    input.checkpoint,
  );
  let balanceMinor: number | null = null;
  if (input.checkpoint) {
    try {
      balanceMinor =
        calculateAccountBalance({
          checkpoint: input.checkpoint,
          transactionsAfterCheckpoint: after,
        })?.amountMinor ?? null;
    } catch {
      balanceMinor = null;
    }
  }
  return {
    ownerUserId: input.account.userId,
    actorUserId: input.actorUserId,
    isActive: input.account.isActive,
    isDefault: input.account.isDefault,
    activeCount: input.activeCount,
    hasLedgerHistory: accountHasLedgerHistory(input.transactions),
    balanceMinor,
  };
}
