import { money, type Money } from "@/domain/money";
import {
  applyTransactionToBalance,
  balanceEffectForTransaction,
} from "./balance";
import { calculatePlanTotals, type PlanSpendInput } from "./plan-totals";
import { calculateSafeToSpend } from "./safe-to-spend";
import type { CanonicalTransaction, PlanItem } from "./types";

/**
 * Undo today's confirmed balance moves so we can recover "this morning's"
 * available cash for day-plan / pulse comparisons.
 */
export function availableAtStartOfDayMinor(
  availableNowMinor: number,
  todayTransactions: Array<
    Pick<
      CanonicalTransaction,
      "amountMinor" | "direction" | "transactionType" | "status"
    >
  >,
): number {
  let morning = availableNowMinor;
  for (const tx of todayTransactions) {
    if (tx.status === "voided" || tx.status === "needs_review") continue;
    const effect = balanceEffectForTransaction(tx);
    // Reverse applyTransactionToBalance
    if (effect === "decrease") morning += tx.amountMinor;
    else if (effect === "increase") morning -= tx.amountMinor;
  }
  return morning;
}

/**
 * Today's spend plan for plus/minus pulse: safe-to-spend as of morning
 * (before today's balance-affecting activity and before today's plan spend).
 *
 * Forward-looking "tryggt att spendera" stays as current STS separately.
 */
export function calculateDayPlanMinor(input: {
  availableNowMinor: number;
  currency: Money["currency"];
  todayTransactions: Array<
    Pick<
      CanonicalTransaction,
      | "amountMinor"
      | "direction"
      | "transactionType"
      | "status"
      | "description"
      | "category"
      | "currency"
    >
  >;
  /** Period spend used for plan allocation, excluding today's expenses. */
  periodSpendBeforeToday: PlanSpendInput[];
  planItems: PlanItem[];
  now?: Date;
  defaultDaysUntilIncome?: number;
}): number {
  const currency = input.currency;
  const morningAvailableMinor = availableAtStartOfDayMinor(
    input.availableNowMinor,
    input.todayTransactions,
  );
  const totals = calculatePlanTotals(
    input.planItems,
    currency,
    input.now ?? new Date(),
    input.defaultDaysUntilIncome ?? 17,
    input.periodSpendBeforeToday,
  );
  const safe = calculateSafeToSpend({
    available: money(Math.max(0, morningAvailableMinor), currency),
    reserved: money(totals.reservedMinor, currency),
    safetyBuffer: money(totals.bufferMinor, currency),
    daysUntilNextIncome: totals.daysUntilNextIncome,
    flexiblePlanRemaining:
      totals.flexibleMinor > 0
        ? money(totals.flexibleMinor, currency)
        : undefined,
  });
  return safe.today.amountMinor;
}

/** Net balance delta from a set of txs (for tests / debugging). */
export function netBalanceDeltaMinor(
  transactions: Array<
    Pick<
      CanonicalTransaction,
      "amountMinor" | "direction" | "transactionType" | "status"
    >
  >,
): number {
  let balance = 0;
  for (const tx of transactions) {
    balance = applyTransactionToBalance(balance, tx);
  }
  return balance;
}
