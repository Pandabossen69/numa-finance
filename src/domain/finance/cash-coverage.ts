import { appliesToSpending } from "./balance";
import { calendarDaysBetween } from "./datetime";
import {
  addMonthsKey,
  isPlanIncome,
  isPlanSavings,
  isPlanSettled,
  monthKeyFromDate,
  projectPlanForMonth,
  remainingDueIso,
  remainingOpenMinor,
} from "./plan-months";
import type { CanonicalTransaction, PlanItem } from "./types";

/** One-line formula shown on Plan and Hem. */
export const CASH_COVERAGE_HINT_SV = "Saldo + kommer in − kvar att betala";

const DATE_WINDOW_DAYS = 7;
const AMOUNT_FLOOR_MINOR = 500_00;
const AMOUNT_RATIO = 0.05;

/**
 * Ledger rows used to decide whether a plan income/expense has already landed.
 * Intentionally a subset of `CanonicalTransaction` so tests stay light.
 */
export type LedgerMatchTx = Pick<
  CanonicalTransaction,
  | "id"
  | "status"
  | "direction"
  | "transactionType"
  | "amountMinor"
  | "occurredAt"
  | "description"
  | "merchant"
  | "source"
  | "fingerprint"
  | "balanceAfterMinor"
  | "sourceObservationId"
>;

export type CashCoverageView = {
  monthKey: string;
  /** Existing account/saldo figure. Null when unknown — never faked as 0 in the UI. */
  saldoMinor: number | null;
  /** Planned income in the month that has not hit the ledger yet. */
  incomingMinor: number;
  /** Planned expenses in the month that have not hit the ledger yet. Savings excluded. */
  unpaidMinor: number;
  /**
   * `(saldo ?? 0) + incoming − unpaid`.
   * Negative only when remaining bills exceed cash + remaining income.
   */
  overMinor: number;
};

/**
 * Cash coverage for a calendar month (Bangkok civil dates).
 *
 * Paid plan rows that already hit the ledger are dropped from remaining —
 * they live in saldo and must not be subtracted again. Savings is a separate
 * pile, not "kvar att betala".
 */
export function projectCashCoverage(params: {
  planItems: PlanItem[];
  transactions: LedgerMatchTx[];
  monthKey: string;
  timeZone: string;
  saldoMinor: number | null;
}): CashCoverageView {
  const { planItems, transactions, monthKey, timeZone, saldoMinor } = params;
  const plan = projectPlanForMonth(planItems, monthKey, timeZone);
  const incomingMinor = remainingPlanAmount(
    plan.incomes,
    transactions,
    "income",
    monthKey,
    timeZone,
  );
  const unpaidMinor = remainingPlanAmount(
    plan.items,
    transactions,
    "expense",
    monthKey,
    timeZone,
  );
  return {
    monthKey,
    saldoMinor,
    incomingMinor,
    unpaidMinor,
    overMinor: (saldoMinor ?? 0) + incomingMinor - unpaidMinor,
  };
}

function remainingPlanAmount(
  items: PlanItem[],
  transactions: LedgerMatchTx[],
  kind: "income" | "expense",
  monthKey: string,
  timeZone: string,
): number {
  const matched = matchPlanItemsToLedger({
    items,
    transactions,
    kind,
    monthKey,
    timeZone,
  });
  let remaining = 0;
  for (const item of items) {
    if (matched.has(item.id)) continue;
    remaining += remainingOpenMinor(item);
  }
  return remaining;
}

/**
 * 1:1 greedy match: kind + near date + similar amount (name is a tie-break).
 * Each ledger row and each plan row is used at most once.
 */
export function matchPlanItemsToLedger(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): Set<string> {
  const { items, transactions, kind, monthKey, timeZone } = params;
  const eligibleTx = transactions.filter((tx) => {
    if (!isKindHit(tx, kind)) return false;
    const txMonth = monthKeyFromDate(new Date(tx.occurredAt), timeZone);
    return isNearbyMonth(txMonth, monthKey);
  });

  type Pair = { itemId: string; txId: string; score: number };
  const pairs: Pair[] = [];
  for (const item of items) {
    if (isPlanSavings(item) || item.amountMinor <= 0) continue;
    if (isPlanSettled(item)) continue;
    if (kind === "income" && !isPlanIncome(item)) continue;
    if (kind === "expense" && isPlanIncome(item)) continue;
    for (const tx of eligibleTx) {
      const score = pairScore(item, tx, timeZone);
      if (score == null) continue;
      pairs.push({ itemId: item.id, txId: tx.id, score });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedItems = new Set<string>();
  const usedTx = new Set<string>();
  for (const pair of pairs) {
    if (usedItems.has(pair.itemId) || usedTx.has(pair.txId)) continue;
    usedItems.add(pair.itemId);
    usedTx.add(pair.txId);
  }
  return usedItems;
}

function isNearbyMonth(txMonth: string, monthKey: string): boolean {
  return (
    txMonth === monthKey ||
    txMonth === addMonthsKey(monthKey, 1) ||
    txMonth === addMonthsKey(monthKey, -1)
  );
}

function isKindHit(tx: LedgerMatchTx, kind: "income" | "expense"): boolean {
  if (tx.status !== "confirmed") return false;
  if (kind === "expense") return appliesToSpending(tx);
  if (tx.direction !== "credit") return false;
  // Transfers move money between accounts — not planned income landing.
  if (tx.transactionType === "transfer" || tx.transactionType === "cash_withdrawal") {
    return false;
  }
  return true;
}

function amountToleranceMinor(planAmountMinor: number): number {
  return Math.max(
    AMOUNT_FLOOR_MINOR,
    Math.round(Math.abs(planAmountMinor) * AMOUNT_RATIO),
  );
}

function pairScore(item: PlanItem, tx: LedgerMatchTx, timeZone: string): number | null {
  const dueIso = remainingDueIso(item);
  if (!dueIso) return null;
  const dayDiff = Math.abs(calendarDaysBetween(dueIso, tx.occurredAt, timeZone));
  if (dayDiff > DATE_WINDOW_DAYS) return null;

  const planAmount = remainingOpenMinor(item) > 0 ? remainingOpenMinor(item) : item.amountMinor;
  const amountDiff = Math.abs(planAmount - tx.amountMinor);
  const tolerance = amountToleranceMinor(planAmount);
  if (amountDiff > tolerance) return null;

  const dateScore = 1 - dayDiff / (DATE_WINDOW_DAYS + 1);
  const amountScore = 1 - amountDiff / (tolerance + 1);
  return dateScore * 2 + amountScore * 2 + nameBonus(item, tx);
}

function nameBonus(item: PlanItem, tx: LedgerMatchTx): number {
  const planName = normalizeMatchText(item.name);
  if (planName.length < 3) return 0;
  const hay = normalizeMatchText(`${tx.description ?? ""} ${tx.merchant ?? ""}`);
  if (hay.includes(planName)) return 0.35;
  const first = planName.split(" ")[0] ?? "";
  if (first.length >= 3 && hay.includes(first)) return 0.2;
  return 0;
}

function normalizeMatchText(value: string): string {
  return value.trim().toLocaleLowerCase("sv-SE");
}
