import {
  isPlanIncome,
  isPlanSavings,
  monthKeyFromDate,
  remainingDueIso,
  settledAmountMinor,
} from "./plan-months";
import { NEXT_INCOME_NAME } from "./plan-totals";
import {
  matchPlanItemsToLedger,
  type LedgerMatchTx,
} from "./cash-coverage";
import type { PlanItem } from "./types";

export type PlanSettleKind = "income" | "expense";

export type PlanSettlePreview = {
  kind: PlanSettleKind;
  targetBookedMinor: number;
  /** Signed Hem/account move: income +, expense −. 0 when the bank already booked it. */
  saldoDeltaMinor: number;
  incomingDeltaMinor: number;
  unpaidDeltaMinor: number;
  skippedBecauseFunded: boolean;
};

/** Mottagen / Betald / Delvis — never savings or the "nästa lön" stub. */
export function planSettleKind(item: PlanItem): PlanSettleKind | null {
  if (isPlanSavings(item) || item.name === NEXT_INCOME_NAME) return null;
  if (isPlanIncome(item)) return "income";
  if (item.amountMinor <= 0) return null;
  return "expense";
}

/** Amount the settle flags will claim. Server-trusted — never a client saldo. */
export function planSettleTargetMinor(
  item: PlanItem,
  input: { settled: boolean; requestedMinor?: number | null },
): number {
  if (!input.settled) return 0;
  const requested =
    input.requestedMinor == null ? item.amountMinor : input.requestedMinor;
  if (requested <= 0) return 0;
  return Math.min(item.amountMinor, Math.max(0, Math.round(requested)));
}

export function signedPlanSettleSaldoDelta(
  kind: PlanSettleKind,
  bookedDeltaMinor: number,
): number {
  return kind === "income" ? bookedDeltaMinor : -bookedDeltaMinor;
}

/**
 * Bank/SMS/manual rows only. A synthetic settle booking must not "fund"
 * itself and skip the write, or count as a second landing later.
 */
export function isExternalLedgerTx(tx: LedgerMatchTx): boolean {
  if (tx.status !== "confirmed") return false;
  return tx.planItemId == null || tx.planItemId === "";
}

/**
 * Probe the row as open. If a real ledger hit already matches, Hem saldo
 * already has the money — do not book a second credit/debit.
 */
export function planItemAlreadyFundedInLedger(params: {
  item: PlanItem;
  /** Full plan set so a bank hit is not stolen from a sibling row. */
  planItems?: readonly PlanItem[];
  transactions: readonly LedgerMatchTx[];
  kind: PlanSettleKind;
  monthKey: string;
  timeZone: string;
}): boolean {
  const { item, kind, monthKey, timeZone } = params;
  const probe = (row: PlanItem): PlanItem =>
    row.id === item.id
      ? {
          ...row,
          settledAt: null,
          settledMinor: null,
          remainingDueAt: remainingDueIso(row) ?? row.nextDueAt,
        }
      : row;
  const items = (params.planItems ?? [item]).map(probe);
  const external = params.transactions.filter(isExternalLedgerTx);
  const matched = matchPlanItemsToLedger({
    items,
    transactions: external,
    kind,
    monthKey,
    timeZone,
  });
  return matched.has(item.id);
}

export function monthKeyForPlanSettle(
  item: PlanItem,
  timeZone: string,
  now: Date = new Date(),
): string {
  const due = remainingDueIso(item) ?? item.nextDueAt;
  if (due) return monthKeyFromDate(new Date(due), timeZone);
  return monthKeyFromDate(now, timeZone);
}

/**
 * Client + server share this so optimistic cards match the write.
 * Coverage deltas stay 0 when the matcher already dropped the row.
 */
export function previewPlanSettleEffect(params: {
  item: PlanItem;
  planItems?: readonly PlanItem[];
  targetBookedMinor: number;
  transactions: readonly LedgerMatchTx[];
  timeZone: string;
}): PlanSettlePreview | null {
  const kind = planSettleKind(params.item);
  if (!kind) return null;
  const target = Math.max(0, Math.round(params.targetBookedMinor));
  const previous = settledAmountMinor(params.item);
  const monthKey = monthKeyForPlanSettle(params.item, params.timeZone);
  const funded = planItemAlreadyFundedInLedger({
    item: params.item,
    planItems: params.planItems,
    transactions: params.transactions,
    kind,
    monthKey,
    timeZone: params.timeZone,
  });
  const flagDelta = target - previous;
  const bookedDelta = funded ? 0 : flagDelta;
  return {
    kind,
    targetBookedMinor: target,
    saldoDeltaMinor: signedPlanSettleSaldoDelta(kind, bookedDelta),
    incomingDeltaMinor: kind === "income" && !funded ? -flagDelta : 0,
    unpaidDeltaMinor: kind === "expense" && !funded ? -flagDelta : 0,
    skippedBecauseFunded: funded,
  };
}
