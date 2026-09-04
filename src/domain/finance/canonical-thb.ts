import type { CurrencyCode } from "@/domain/money";
import { balanceToThbMinor } from "./total-saldo";
import type { Account, BalanceCheckpoint, CanonicalTransaction } from "./types";

/**
 * Canonical household currency. Every Hem / Plan / Analys spend figure
 * is expressed in THB after this conversion — never a guessed ฿0.
 */
export const CANONICAL_CURRENCY: CurrencyCode = "THB";

export type FxCheckpoint = Pick<
  BalanceCheckpoint,
  "thbMinor" | "fxRate" | "balanceMinor" | "accountId"
>;

/**
 * Convert a native-currency amount to THB using the account's locked
 * checkpoint rate. Same convention as saldo: `round(nativeMinor * fxRate)`.
 *
 * Returns null when the amount cannot be expressed in THB.
 */
export function amountToThbMinor(
  amountMinor: number,
  currency: CurrencyCode,
  checkpoint: FxCheckpoint | null | undefined,
): number | null {
  return balanceToThbMinor(amountMinor, currency, checkpoint);
}

export function transactionToThbMinor(
  tx: Pick<
    CanonicalTransaction,
    "amountMinor" | "currency" | "accountId" | "thbMinor"
  >,
  checkpointByAccountId: ReadonlyMap<string, FxCheckpoint | null>,
): number | null {
  if (tx.thbMinor != null) return tx.thbMinor;
  return amountToThbMinor(
    tx.amountMinor,
    tx.currency,
    checkpointByAccountId.get(tx.accountId) ?? null,
  );
}

/**
 * Project a ledger row into canonical THB for spend / funding / revision.
 * This copy overwrites amountMinor/currency with THB. Keep the original row
 * (or TodaySnapshot.ledgerTransactions) when a screen must prefill native.
 */
export function toCanonicalThbTransaction(
  tx: CanonicalTransaction,
  checkpointByAccountId: ReadonlyMap<string, FxCheckpoint | null>,
): CanonicalTransaction | null {
  const thb = transactionToThbMinor(tx, checkpointByAccountId);
  if (thb == null) return null;
  if (tx.currency === CANONICAL_CURRENCY && (tx.thbMinor == null || tx.thbMinor === tx.amountMinor)) {
    return tx;
  }
  return {
    ...tx,
    amountMinor: thb,
    currency: CANONICAL_CURRENCY,
  };
}

export function projectLedgerToCanonicalThb(
  transactions: readonly CanonicalTransaction[],
  checkpointByAccountId: ReadonlyMap<string, FxCheckpoint | null>,
): CanonicalTransaction[] {
  const out: CanonicalTransaction[] = [];
  for (const tx of transactions) {
    const projected = toCanonicalThbTransaction(tx, checkpointByAccountId);
    if (projected) out.push(projected);
  }
  return out;
}

export function checkpointMapForAccounts(
  accounts: readonly Account[],
  checkpoints: readonly (BalanceCheckpoint | null)[],
): Map<string, FxCheckpoint | null> {
  const map = new Map<string, FxCheckpoint | null>();
  accounts.forEach((account, i) => {
    map.set(account.id, checkpoints[i] ?? null);
  });
  return map;
}
