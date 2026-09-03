import {
  appliesToSpending,
  computeSpendingWindows,
  type SpendingWindows,
} from "./balance";
import { calendarDaysBetween } from "./datetime";
import {
  addMonthsKey,
  isPlanIncome,
  isPlanPartiallySettled,
  isPlanSavings,
  isPlanSettled,
  monthKeyFromDate,
  projectPlanForMonth,
  remainingDueIso,
  remainingOpenMinor,
  sumCountsTowardCashMinor,
} from "./plan-months";
import type { CanonicalTransaction, PlanItem } from "./types";


/** One-line formula shown on Plan and Hem. */
export const CASH_COVERAGE_HINT_SV = "På kontona + kommer in − kvar att betala";

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
> & {
  /** Present on synthetic settle bookings — excluded from "already funded" probes. */
  planItemId?: string | null;
};

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
  return sumCountsTowardCashMinor(items, matched);
}

/**
 * 1:1 greedy match: kind + near date + similar amount (name is a tie-break).
 * Each ledger row and each plan row is used at most once.
 *
 * Money only. This keeps Över from subtracting cash that already left the
 * account, and it is a guess — never a claim that the user paid the row.
 * It must not reach the Plan list chips, sorting, or the settle flags.
 */
export function matchPlanLedgerPairs(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): { itemIds: Set<string>; txIds: Set<string> } {
  const { items, transactions, kind, monthKey, timeZone } = params;
  const eligibleTx = transactions.filter((tx) => {
    // Settle bookings live in saldo via flags. They must not "pay" a sibling bill.
    if (tx.planItemId) return false;
    if (!isKindHit(tx, kind)) return false;
    const txMonth = monthKeyFromDate(new Date(tx.occurredAt), timeZone);
    return isNearbyMonth(txMonth, monthKey);
  });

  type Pair = { itemId: string; txId: string; score: number };
  const pairs: Pair[] = [];
  for (const item of items) {
    if (isPlanSavings(item) || item.amountMinor <= 0) continue;
    if (isPlanSettled(item) || isPlanPartiallySettled(item)) continue;
    if (kind === "income" && !isPlanIncome(item)) continue;
    if (kind === "expense" && isPlanIncome(item)) continue;
    for (const tx of eligibleTx) {
      const score = pairScore(item, tx, timeZone);
      if (score == null) continue;
      pairs.push({ itemId: item.id, txId: tx.id, score });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const itemIds = new Set<string>();
  const txIds = new Set<string>();
  for (const pair of pairs) {
    if (itemIds.has(pair.itemId) || txIds.has(pair.txId)) continue;
    itemIds.add(pair.itemId);
    txIds.add(pair.txId);
  }
  return { itemIds, txIds };
}

export function matchPlanItemsToLedger(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): Set<string> {
  return matchPlanLedgerPairs(params).itemIds;
}

/**
 * External ledger expenses already reserved as unpaid plan rows.
 * Living-budget / extra must not subtract these again. Rörelser still shows them.
 * Synthetic settle bookings (`planItemId`) stay in cycle spend — reservation
 * already shrank via remainingOpenMinor.
 */
export function reservedPlanExpenseTxIds(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  monthKey: string;
  timeZone: string;
}): Set<string> {
  return matchPlanLedgerPairs({ ...params, kind: "expense" }).txIds;
}

export function excludeReservedPlanSpend<T extends { id: string }>(
  transactions: readonly T[],
  reservedTxIds: ReadonlySet<string>,
): T[] {
  if (reservedTxIds.size === 0) return [...transactions];
  return transactions.filter((tx) => !reservedTxIds.has(tx.id));
}

/** Day/month/cycle spend that is not already reserved as an unpaid plan bill. */
export function computeDiscretionarySpendingWindows(params: {
  transactions: CanonicalTransaction[];
  planItems: PlanItem[];
  currency: CanonicalTransaction["currency"];
  now?: Date;
  timeZone: string;
  monthKey: string;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
}): SpendingWindows {
  const reserved = reservedPlanExpenseTxIds({
    items: params.planItems,
    transactions: params.transactions,
    monthKey: params.monthKey,
    timeZone: params.timeZone,
  });
  return computeSpendingWindows({
    transactions: excludeReservedPlanSpend(params.transactions, reserved),
    currency: params.currency,
    now: params.now,
    timeZone: params.timeZone,
    cycleStartAt: params.cycleStartAt,
    cycleEndAt: params.cycleEndAt,
  });
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
