import { appliesToSpending } from "./balance";
import { calendarDaysBetween } from "./datetime";
import {
  addMonthsKey,
  cumulativePlanSavingsMinor,
  isPlanIncome,
  isPlanSavings,
  monthKeyFromDate,
  projectPlanForMonth,
  remainingDueIso,
  remainingOpenMinor,
  settledAmountMinor,
} from "./plan-months";
import {
  allocatedCanonicalFromLinks,
  canonicalAmountForLink,
} from "./plan-allocation";
import type { CanonicalTransaction, PlanItem } from "./types";

/** One-line formula shown on Plan and Hem when nothing is satt av. */
export const CASH_COVERAGE_HINT_SV = "På kontona + kommer in − kvar att betala";

/** Över after bills and reserved savings (this month + earlier). */
export function cashOverMinor(input: {
  saldoMinor: number | null;
  incomingMinor: number;
  unpaidMinor: number;
  reservedSavingsMinor?: number;
}): number {
  return (
    (input.saldoMinor ?? 0) +
    input.incomingMinor -
    input.unpaidMinor -
    Math.max(0, input.reservedSavingsMinor ?? 0)
  );
}

/** Same stack as Hem/Plan — include − sparat only when something is reserved. */
export function cashCoverageHintSv(reservedSavingsMinor: number): string {
  return reservedSavingsMinor > 0
    ? "På kontona + kommer in − kvar att betala − sparat"
    : CASH_COVERAGE_HINT_SV;
}

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
  /** This month's avsättning — not yet «sparat». */
  savingsThisMonthMinor: number;
  /** Earlier months' avsättning — labeled «sparat» once the next month starts. */
  savingsPriorMinor: number;
  /** `savingsThisMonth + savingsPrior` — reserved from Över. */
  reservedSavingsMinor: number;
  /**
   * `(saldo ?? 0) + incoming − unpaid − reservedSavings`.
   * Avsätt X moves X from Över into the savings pile (total unchanged).
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
  const savingsThisMonthMinor = plan.savingsMinor;
  const reservedSavingsMinor = cumulativePlanSavingsMinor(
    planItems,
    monthKey,
    timeZone,
  );
  const savingsPriorMinor = Math.max(0, reservedSavingsMinor - savingsThisMonthMinor);
  return {
    monthKey,
    saldoMinor,
    incomingMinor,
    unpaidMinor,
    savingsThisMonthMinor,
    savingsPriorMinor,
    reservedSavingsMinor,
    overMinor: cashOverMinor({
      saldoMinor,
      incomingMinor,
      unpaidMinor,
      reservedSavingsMinor,
    }),
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
    // Allocation model: keep suggesting while real links have not filled the
    // bill. Synthetic Klar / Delvis must stay linkable so a later SMS can
    // replace the booking. Fully funded by confirmed links is done.
    if (allocatedCanonicalFromLinks(item, transactions) >= item.amountMinor) {
      continue;
    }
    if (kind === "income" && !isPlanIncome(item)) continue;
    if (kind === "expense" && isPlanIncome(item)) continue;
    for (const tx of eligibleTx) {
      const score = pairScore(item, tx, timeZone);
      if (score == null) continue;
      pairs.push({ itemId: item.id, txId: tx.id, score });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const usedTx = new Set<string>();
  const chosen: PlanMatchPair[] = [];
  for (const pair of pairs) {
    if (usedTx.has(pair.txId)) continue;
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

  let txCanonical: number;
  try {
    txCanonical = canonicalAmountForLink(tx);
  } catch {
    return null;
  }
  if (txCanonical <= 0) return null;

  const remaining = remainingOpenMinor(item);
  const planAmount = remaining > 0 ? remaining : item.amountMinor;
  if (planAmount <= 0) return null;

  const amountDiff = Math.abs(planAmount - txCanonical);
  const tolerance = amountToleranceMinor(planAmount);
  const nearRemaining = amountDiff <= tolerance;
  const named = nameBonus(item, tx) > 0;
  const significantPartial =
    txCanonical <= planAmount &&
    txCanonical >= Math.max(AMOUNT_FLOOR_MINOR, Math.round(planAmount * 0.2));
  if (!nearRemaining && !(txCanonical <= planAmount && (named || significantPartial))) {
    return null;
  }

  const dateScore = 1 - dayDiff / (DATE_WINDOW_DAYS + 1);
  const amountScore = 1 - Math.min(amountDiff, planAmount) / (planAmount + 1);
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
