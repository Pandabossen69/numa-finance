import { money, type Money } from "@/domain/money";
import type {
  BalanceCheckpoint,
  CanonicalTransaction,
  TransactionType,
} from "./types";

export type BalanceEffect = "increase" | "decrease" | "none";

/**
 * How a confirmed transaction affects an account's calculated balance.
 * Transfers and cash withdrawals move money; they are not automatically spending.
 */
export function balanceEffectForTransaction(
  tx: Pick<CanonicalTransaction, "direction" | "transactionType">,
): BalanceEffect {
  if (tx.transactionType === "transfer") {
    return tx.direction === "debit" ? "decrease" : "increase";
  }

  if (tx.transactionType === "cash_withdrawal") {
    return tx.direction === "debit" ? "decrease" : "increase";
  }

  if (tx.transactionType === "refund") {
    return tx.direction === "credit" ? "increase" : "decrease";
  }

  if (tx.transactionType === "income") {
    return "increase";
  }

  if (tx.transactionType === "expense") {
    return "decrease";
  }

  if (tx.transactionType === "adjustment") {
    return tx.direction === "credit" ? "increase" : "decrease";
  }

  // unknown — still apply direction so balances stay honest, but spending filters exclude it
  return tx.direction === "debit" ? "decrease" : "increase";
}

export function appliesToSpending(
  tx: Pick<CanonicalTransaction, "transactionType" | "status">,
): boolean {
  if (tx.status !== "confirmed") return false;
  return tx.transactionType === "expense";
}

export function appliesToIncome(
  tx: Pick<CanonicalTransaction, "transactionType" | "status">,
): boolean {
  if (tx.status !== "confirmed") return false;
  return tx.transactionType === "income";
}

export function applyTransactionToBalance(
  balanceMinor: number,
  tx: Pick<
    CanonicalTransaction,
    "amountMinor" | "direction" | "transactionType" | "status"
  >,
): number {
  if (tx.status === "voided") return balanceMinor;
  if (tx.status === "needs_review") return balanceMinor;

  const effect = balanceEffectForTransaction(tx);
  if (effect === "increase") return balanceMinor + tx.amountMinor;
  if (effect === "decrease") return balanceMinor - tx.amountMinor;
  return balanceMinor;
}

/**
 * calculated = latest checkpoint + subsequent confirmed/pending_sync transactions
 * ordered by occurred_at ascending (then created_at).
 */
export function calculateAccountBalance(params: {
  checkpoint: BalanceCheckpoint | null;
  transactionsAfterCheckpoint: CanonicalTransaction[];
}): Money | null {
  const { checkpoint, transactionsAfterCheckpoint } = params;
  if (!checkpoint) return null;

  let balance = checkpoint.balanceMinor;
  for (const tx of transactionsAfterCheckpoint) {
    if (tx.currency !== checkpoint.currency) {
      throw new Error("Transaction currency does not match checkpoint currency");
    }
    if (tx.status === "needs_review" || tx.status === "voided") continue;
    balance = applyTransactionToBalance(balance, tx);
  }

  return money(balance, checkpoint.currency);
}

/**
 * Bank-SMS tip checkpoints already embed every bubble's effect
 * (available balance after the newest SMS). Re-applying those
 * screenshot/sms rows would double-count (e.g. 10108 + 3400 = 13508).
 */
function isSmsTipCheckpoint(checkpoint: BalanceCheckpoint): boolean {
  return (
    checkpoint.source === "sms_import" ||
    checkpoint.source === "sms_bootstrap"
  );
}

function isBankSmsLedgerRow(
  tx: Pick<CanonicalTransaction, "source">,
): boolean {
  return tx.source === "screenshot" || tx.source === "sms";
}

export function filterTransactionsAfterCheckpoint(
  transactions: CanonicalTransaction[],
  checkpoint: BalanceCheckpoint | null,
): CanonicalTransaction[] {
  if (!checkpoint) return [];
  const checkpointTime = Date.parse(checkpoint.verifiedAt);
  const smsTip = isSmsTipCheckpoint(checkpoint);

  return transactions
    .filter((tx) => {
      const t = Date.parse(tx.occurredAt);
      // Include transactions at/after checkpoint time.
      if (!(t >= checkpointTime)) return false;
      // Tip available-balance is absolute truth — bank-SMS rows stay in
      // history/lists but must not move calculated saldo again.
      if (smsTip && isBankSmsLedgerRow(tx)) return false;
      return true;
    })
    .sort((a, b) => {
      const byOccurred = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
}

export function sumSpending(
  transactions: CanonicalTransaction[],
  currency: CanonicalTransaction["currency"],
): Money {
  let total = 0;
  for (const tx of transactions) {
    if (!appliesToSpending(tx)) continue;
    if (tx.currency !== currency) continue;
    total += tx.amountMinor;
  }
  return money(total, currency);
}

export function isSpendingType(type: TransactionType): boolean {
  return type === "expense";
}
