import { money, type Money } from "@/domain/money";
import { DEFAULT_TIMEZONE, zonedDayKey } from "./datetime";
import { monthKeyFromDate } from "./plan-months";
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

type BankSmsLedgerHints = Partial<
  Pick<
    CanonicalTransaction,
    "source" | "fingerprint" | "balanceAfterMinor" | "sourceObservationId"
  >
>;

/**
 * Bank-SMS / tip-ledger rows stay in history lists but must not move
 * household spend totals (or tip-checkpoint saldo again).
 *
 * Primary signal: source screenshot/sms/bank_import.
 * Fallback: fingerprint + tip balance + observation — catches legacy rows
 * mis-tagged as receipt_camera/manual while still being bank-SMS imports.
 */
export function isBankSmsLedgerRow(tx: BankSmsLedgerHints): boolean {
  if (
    tx.source === "screenshot" ||
    tx.source === "sms" ||
    tx.source === "bank_import"
  ) {
    return true;
  }
  return (
    tx.fingerprint != null &&
    tx.balanceAfterMinor != null &&
    tx.sourceObservationId != null
  );
}

export function appliesToSpending(
  tx: Pick<CanonicalTransaction, "transactionType" | "status"> &
    BankSmsLedgerHints,
): boolean {
  if (tx.status !== "confirmed") return false;
  // Bank-SMS ledger rows are history for the tip checkpoint — not household spend.
  if (isBankSmsLedgerRow(tx)) return false;
  return tx.transactionType === "expense";
}

export function appliesToIncome(
  tx: Pick<CanonicalTransaction, "transactionType" | "status"> &
    BankSmsLedgerHints,
): boolean {
  if (tx.status !== "confirmed") return false;
  // PromptPay/SMS credits are already embedded in tip saldo — not "intäkt".
  if (isBankSmsLedgerRow(tx)) return false;
  return tx.transactionType === "income";
}

export function applyTransactionToBalance(
  balanceMinor: number,
  tx: Pick<
    CanonicalTransaction,
    "amountMinor" | "direction" | "transactionType" | "status"
  > &
    Partial<Pick<CanonicalTransaction, "source">>,
): number {
  if (tx.status === "voided") return balanceMinor;
  if (tx.status === "needs_review") return balanceMinor;
  // Bank-SMS history is tip truth — never move saldo from the ledger row.
  if (isBankSmsLedgerRow(tx)) return balanceMinor;

  const effect = balanceEffectForTransaction(tx);
  if (effect === "increase") return balanceMinor + tx.amountMinor;
  if (effect === "decrease") return balanceMinor - tx.amountMinor;
  return balanceMinor;
}

/**
 * calculated = latest checkpoint + subsequent confirmed/pending_sync transactions
 * ordered by occurred_at ascending (then created_at).
 *
 * Bank-SMS rows are never applied: tip checkpoints already embed their effect.
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
    if (isBankSmsLedgerRow(tx)) continue;
    balance = applyTransactionToBalance(balance, tx);
  }

  return money(balance, checkpoint.currency);
}

/**
 * Bank-SMS tip checkpoints already embed every bubble's effect
 * (available balance after the newest SMS). Re-applying those
 * screenshot/sms rows would double-count (e.g. 10108 + 3400 = 13508).
 */
export function isSmsTipCheckpoint(checkpoint: BalanceCheckpoint): boolean {
  return (
    checkpoint.source === "sms_import" ||
    checkpoint.source === "sms_bootstrap" ||
    // Legacy checkpoints written before sms_import/sms_bootstrap naming.
    checkpoint.source === "sms"
  );
}

/**
 * Only write a tip checkpoint when the newest SMS in the shot is newly imported.
 * Re-importing older unknowns must not rewind verifiedAt and erase later manuals.
 */
export function shouldWriteSmsTipCheckpoint(params: {
  tipBalanceMinor: number | null | undefined;
  tipInBatch: boolean;
}): boolean {
  return params.tipBalanceMinor != null && params.tipInBatch;
}

/**
 * Resolve tip available-balance for confirm. Never fall back to the oldest
 * bubble's per-row balance (pending[0] after ascending batchIndex sort).
 */
export function resolveSmsTipBalanceMinor(params: {
  inputBalanceAfterMinor?: number | null;
  payloadTipBalanceMinor?: number | null;
  /** When false, tip must not update Hem even if a number is present. */
  updatesBalance?: boolean | null;
}): number | null {
  if (params.updatesBalance === false) return null;
  if (params.inputBalanceAfterMinor != null) {
    return params.inputBalanceAfterMinor;
  }
  if (params.payloadTipBalanceMinor != null) {
    return params.payloadTipBalanceMinor;
  }
  return null;
}

export function filterTransactionsAfterCheckpoint(
  transactions: CanonicalTransaction[],
  checkpoint: BalanceCheckpoint | null,
): CanonicalTransaction[] {
  if (!checkpoint) return [];
  const checkpointTime = Date.parse(checkpoint.verifiedAt);

  return transactions
    .filter((tx) => {
      const t = Date.parse(tx.occurredAt);
      // Include transactions at/after checkpoint time.
      if (!(t >= checkpointTime)) return false;
      // Bank-SMS ledger rows stay in history/lists but never move saldo —
      // tip available-balance (or a later tip) is absolute truth.
      if (isBankSmsLedgerRow(tx)) return false;
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

export type SpendingWindows = {
  today: Money;
  month: Money;
  cycle: Money;
};

/**
 * Calendar-window spend totals in the user's timezone.
 *
 * - today: same Asia/Bangkok (etc.) calendar day as `now` — never UTC date slice
 * - month: same YYYY-MM calendar month as `now`
 * - cycle: occurredAt on/after cycle start (when provided)
 *
 * Bank-SMS / screenshot / sms rows never count (via sumSpending → appliesToSpending).
 * Invariant: today.amountMinor <= month.amountMinor for the same currency filter.
 */
export function computeSpendingWindows(params: {
  transactions: CanonicalTransaction[];
  currency: CanonicalTransaction["currency"];
  now?: Date;
  timeZone?: string;
  cycleStartAt?: string | null;
}): SpendingWindows {
  const now = params.now ?? new Date();
  const timeZone = params.timeZone || DEFAULT_TIMEZONE;
  const todayKey = zonedDayKey(now, timeZone);
  const monthKey = monthKeyFromDate(now, timeZone);
  const cycleStartMs =
    params.cycleStartAt != null ? Date.parse(params.cycleStartAt) : NaN;

  const todayTx: CanonicalTransaction[] = [];
  const monthTx: CanonicalTransaction[] = [];
  const cycleTx: CanonicalTransaction[] = [];

  for (const tx of params.transactions) {
    if (tx.status !== "confirmed") continue;
    if (tx.currency !== params.currency) continue;

    const dayKey = zonedDayKey(tx.occurredAt, timeZone);
    const txMonthKey = monthKeyFromDate(new Date(tx.occurredAt), timeZone);

    if (dayKey === todayKey) todayTx.push(tx);
    if (txMonthKey === monthKey) monthTx.push(tx);
    if (Number.isFinite(cycleStartMs) && Date.parse(tx.occurredAt) >= cycleStartMs) {
      cycleTx.push(tx);
    }
  }

  return {
    today: sumSpending(todayTx, params.currency),
    month: sumSpending(monthTx, params.currency),
    cycle: sumSpending(cycleTx, params.currency),
  };
}
