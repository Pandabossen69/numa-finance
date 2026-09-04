import { appliesToSpending } from "./balance";
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
  settledAmountMinor,
} from "./plan-months";
import { allocatedCanonicalFromLinks } from "./plan-allocation";
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
  ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
  /** User-confirmed link. Heuristic matches must not write this. */
  linkedPlanItemId?: string | null;
  currency?: CanonicalTransaction["currency"];
  thbMinor?: number | null;
};

export type PlanMatchPair = { itemId: string; txId: string; score: number };

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
 * Paid plan rows are dropped from remaining only when the user marked them
 * Klar / Delvis or confirmed an explicit transaction↔plan link. The ±7-day
 * heuristic is suggestion-only and must never silently remove an obligation.
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
  const incomingMinor = remainingPlanAmount(plan.incomes, transactions);
  const unpaidMinor = remainingPlanAmount(plan.items, transactions);
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
): number {
  // Settle flags plus confirmed allocation amounts — never a heuristic match,
  // and never treat a partial link as a full settlement.
  let sum = 0;
  for (const item of items) {
    const allocated = allocatedCanonicalFromLinks(item, transactions);
    const claimed = Math.max(settledAmountMinor(item), allocated);
    sum += Math.max(0, item.amountMinor - claimed);
  }
  return sum;
}

/**
 * 1:1 greedy match: kind + near date + similar amount (name is a tie-break).
 * Each ledger row and each plan row is used at most once.
 *
 * Suggestion only — never a claim that the user paid the row, and never
 * applied to Över / Kvar att betala / Kommer in. It must not reach the Plan list
 * chips, sorting, or the settle flags.
 */
/**
 * Suggestion pairs only. Callers must not apply these to unpaid / incoming
 * or settle flags — that requires an explicit user confirm.
 */
export function matchPlanItemPairs(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): PlanMatchPair[] {
  const { items, transactions, kind, monthKey, timeZone } = params;
  const eligibleTx = transactions.filter((tx) => {
    if (tx.planItemId) return false;
    if (tx.ledgerOrigin === "plan_settle") return false;
    if (tx.linkedPlanItemId) return false;
    if (!isKindHit(tx, kind)) return false;
    const txMonth = monthKeyFromDate(new Date(tx.occurredAt), timeZone);
    return isNearbyMonth(txMonth, monthKey);
  });

  const pairs: PlanMatchPair[] = [];
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
  const usedItems = new Set<string>();
  const usedTx = new Set<string>();
  const chosen: PlanMatchPair[] = [];
  for (const pair of pairs) {
    if (usedItems.has(pair.itemId) || usedTx.has(pair.txId)) continue;
    usedItems.add(pair.itemId);
    usedTx.add(pair.txId);
    chosen.push(pair);
  }
  return chosen;
}

/** Item ids from the suggestion matcher. Never a claim that the bill is paid. */
export function matchPlanItemsToLedger(params: {
  items: PlanItem[];
  transactions: LedgerMatchTx[];
  kind: "income" | "expense";
  monthKey: string;
  timeZone: string;
}): Set<string> {
  return new Set(matchPlanItemPairs(params).map((pair) => pair.itemId));
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
