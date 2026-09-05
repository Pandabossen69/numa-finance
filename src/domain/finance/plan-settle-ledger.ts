import {
  isPlanIncome,
  isPlanSavings,
  monthKeyFromDate,
  remainingDueIso,
  settledAmountMinor,
} from "./plan-months";
import { NEXT_INCOME_NAME } from "./plan-totals";
import { type LedgerMatchTx } from "./cash-coverage";
import { allocatedCanonicalFromLinks } from "./plan-allocation";
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
  if (tx.ledgerOrigin === "plan_settle") return false;
  return tx.planItemId == null || tx.planItemId === "";
}

/**
 * True only when the user confirmed a transaction↔plan link.
 * The ±7-day heuristic must never skip a settle booking.
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
  void params.kind;
  void params.monthKey;
  void params.timeZone;
  void params.planItems;
  const allocated = allocatedCanonicalFromLinks(
    params.item,
    params.transactions.filter(isExternalLedgerTx),
  );
  return allocated >= params.item.amountMinor && params.item.amountMinor > 0;
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
  const allocated = allocatedCanonicalFromLinks(
    params.item,
    params.transactions.filter(isExternalLedgerTx),
  );
  const previousSynth = Math.max(0, previous - allocated);
  const nextSynth = Math.max(0, target - allocated);
  const bookedDelta = nextSynth - previousSynth;
  const claimedBefore = Math.max(previous, allocated);
  const claimedAfter = Math.max(target, allocated);
  const coverageDelta =
    Math.max(0, params.item.amountMinor - claimedAfter) -
    Math.max(0, params.item.amountMinor - claimedBefore);
  return {
    kind,
    targetBookedMinor: target,
    saldoDeltaMinor: signedPlanSettleSaldoDelta(kind, bookedDelta),
    incomingDeltaMinor: kind === "income" ? coverageDelta : 0,
    unpaidDeltaMinor: kind === "expense" ? coverageDelta : 0,
    skippedBecauseFunded: nextSynth === 0 && allocated > 0,
  };
}
