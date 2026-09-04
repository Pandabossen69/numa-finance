import { money, type Money } from "@/domain/money";
import { DEFAULT_TIMEZONE, zonedDayKey } from "./datetime";
import { monthKeyFromDate } from "./plan-months";
import { appliesToSpending } from "./balance";
import type { CanonicalTransaction } from "./types";

/**
 * How a confirmed expense should count.
 *
 * - total: every real expense, including planned-bill settlements
 *   (cycle accounting / Kvar i perioden)
 * - discretionary: flexible day spend only — never a plan settle booking
 *   or an explicitly linked planned-bill payment
 * - planned_paid: synthetic settle or user-confirmed plan link
 */
export type SpendClass = "discretionary" | "planned_paid" | "none";

export function isPlanSettleBooking(
  tx: Pick<CanonicalTransaction, "ledgerOrigin" | "planItemId">,
): boolean {
  if (tx.ledgerOrigin === "plan_settle") return true;
  // Legacy rows written before ledger_origin existed.
  return Boolean(tx.planItemId);
}

export function isExplicitPlanPayment(
  tx: Pick<CanonicalTransaction, "linkedPlanItemId" | "ledgerOrigin" | "planItemId">,
): boolean {
  if (tx.linkedPlanItemId) return true;
  return isPlanSettleBooking(tx);
}

export function classifySpend(
  tx: Pick<
    CanonicalTransaction,
    | "transactionType"
    | "status"
    | "ledgerOrigin"
    | "planItemId"
    | "linkedPlanItemId"
    | "source"
    | "fingerprint"
    | "balanceAfterMinor"
    | "sourceObservationId"
  >,
): SpendClass {
  if (!appliesToSpending(tx)) return "none";
  if (isExplicitPlanPayment(tx)) return "planned_paid";
  return "discretionary";
}

export function appliesToDiscretionarySpending(
  tx: Parameters<typeof classifySpend>[0],
): boolean {
  return classifySpend(tx) === "discretionary";
}

export function appliesToPlannedPaidSpending(
  tx: Parameters<typeof classifySpend>[0],
): boolean {
  return classifySpend(tx) === "planned_paid";
}

export function appliesToTotalSpending(
  tx: Parameters<typeof classifySpend>[0],
): boolean {
  return classifySpend(tx) !== "none";
}

export type ClassifiedSpendingWindows = {
  /** All confirmed expenses (discretionary + planned bills). */
  total: Money;
  /** Flexible allowance — excludes settlements and linked plan payments. */
  discretionary: Money;
  /** Planned-bill payments booked or linked today / in the window. */
  plannedPaid: Money;
};

export type SplitSpendingWindows = {
  today: ClassifiedSpendingWindows;
  month: ClassifiedSpendingWindows;
  cycle: ClassifiedSpendingWindows;
};

function emptyWindows(currency: CanonicalTransaction["currency"]): ClassifiedSpendingWindows {
  return {
    total: money(0, currency),
    discretionary: money(0, currency),
    plannedPaid: money(0, currency),
  };
}

function addClassified(
  bucket: ClassifiedSpendingWindows,
  tx: CanonicalTransaction,
  spend: SpendClass,
): void {
  if (spend === "none") return;
  bucket.total = money(bucket.total.amountMinor + tx.amountMinor, bucket.total.currency);
  if (spend === "discretionary") {
    bucket.discretionary = money(
      bucket.discretionary.amountMinor + tx.amountMinor,
      bucket.discretionary.currency,
    );
  } else {
    bucket.plannedPaid = money(
      bucket.plannedPaid.amountMinor + tx.amountMinor,
      bucket.plannedPaid.currency,
    );
  }
}

/**
 * Calendar-window spend totals split for day vs cycle accounting.
 *
 * Transfers and cash withdrawals never enter these buckets (appliesToSpending).
 * `transactions` must already be in the snapshot currency (canonical THB).
 */
/**
 * Decide Spenderat idag vs Betalda räkningar idag when the Plan ledger
 * the client syncs from may be stale or missing origin/link fields.
 *
 * A planned settlement must never inflate discretionary spend. If Hem already
 * booked planned-paid (optimistic settle or a prior server snapshot) and the
 * incoming ledger either dropped those fields or has not caught up yet, keep
 * the Hem split instead of treating the bill as lunch money.
 */
export function resolveTodaySpendSplit(input: {
  ledgerDiscretionaryMinor: number;
  ledgerPlannedPaidMinor: number;
  ledgerTotalMinor: number;
  homeDiscretionaryMinor: number;
  homePlannedPaidMinor: number;
  homeDirty: boolean;
}): { discretionaryMinor: number; plannedPaidMinor: number } {
  const ledgerDisc = Math.max(0, input.ledgerDiscretionaryMinor);
  const ledgerPlanned = Math.max(0, input.ledgerPlannedPaidMinor);
  const ledgerTotal = Math.max(0, input.ledgerTotalMinor);
  const homeDisc = Math.max(0, input.homeDiscretionaryMinor);
  const homePlanned = Math.max(0, input.homePlannedPaidMinor);

  if (ledgerPlanned > 0) {
    return {
      discretionaryMinor: input.homeDirty ? Math.max(homeDisc, ledgerDisc) : ledgerDisc,
      plannedPaidMinor: input.homeDirty
        ? Math.max(homePlanned, ledgerPlanned)
        : ledgerPlanned,
    };
  }

  if (homePlanned > 0 && ledgerTotal >= homeDisc + homePlanned) {
    return {
      discretionaryMinor: Math.max(0, ledgerTotal - homePlanned),
      plannedPaidMinor: homePlanned,
    };
  }

  if (homePlanned > 0 && ledgerTotal <= homeDisc) {
    return {
      discretionaryMinor: input.homeDirty ? Math.max(homeDisc, ledgerDisc) : homeDisc,
      plannedPaidMinor: homePlanned,
    };
  }

  return {
    discretionaryMinor: input.homeDirty ? Math.max(homeDisc, ledgerDisc) : ledgerDisc,
    plannedPaidMinor: input.homeDirty ? Math.max(homePlanned, ledgerPlanned) : ledgerPlanned,
  };
}

export function computeClassifiedSpendingWindows(params: {
  transactions: CanonicalTransaction[];
  currency: CanonicalTransaction["currency"];
  now?: Date;
  timeZone?: string;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
}): SplitSpendingWindows {
  const now = params.now ?? new Date();
  const timeZone = params.timeZone || DEFAULT_TIMEZONE;
  const todayKey = zonedDayKey(now, timeZone);
  const monthKey = monthKeyFromDate(now, timeZone);
  const cycleStartMs =
    params.cycleStartAt != null ? Date.parse(params.cycleStartAt) : NaN;
  const cycleEndMs =
    params.cycleEndAt != null ? Date.parse(params.cycleEndAt) : NaN;

  const today = emptyWindows(params.currency);
  const month = emptyWindows(params.currency);
  const cycle = emptyWindows(params.currency);

  for (const tx of params.transactions) {
    if (tx.currency !== params.currency) continue;
    const spend = classifySpend(tx);
    if (spend === "none") continue;

    const dayKey = zonedDayKey(tx.occurredAt, timeZone);
    const txMonthKey = monthKeyFromDate(new Date(tx.occurredAt), timeZone);
    const occurredMs = Date.parse(tx.occurredAt);

    if (dayKey === todayKey) addClassified(today, tx, spend);
    if (txMonthKey === monthKey) addClassified(month, tx, spend);
    if (Number.isFinite(cycleStartMs) && occurredMs >= cycleStartMs) {
      if (!Number.isFinite(cycleEndMs) || occurredMs < cycleEndMs) {
        addClassified(cycle, tx, spend);
      }
    }
  }

  return { today, month, cycle };
}
