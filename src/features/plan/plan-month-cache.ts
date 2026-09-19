import { addMonthsKey, type PlanLinkSuggestion } from "@/domain/finance";
import { stampPlanItems } from "@/features/plan/optimistic";
import {
  buildPlanMonthPaint,
  buildPlanMonthSuggestions,
  type PlanMonthPaint,
  type PlanMonthPaintInput,
} from "@/features/plan/plan-month-paint";

type PaintEntry = { stamp: string; paint: PlanMonthPaint };
type SuggestionEntry = { stamp: string; suggestions: PlanLinkSuggestion[] };

const paints = new Map<string, PaintEntry>();
const suggestions = new Map<string, SuggestionEntry>();
const suggestionListeners = new Set<() => void>();
let suggestionEpoch = 0;

function emitSuggestions() {
  suggestionEpoch += 1;
  for (const listener of suggestionListeners) listener();
}

export function subscribePlanMonthSuggestions(listener: () => void) {
  suggestionListeners.add(listener);
  return () => {
    suggestionListeners.delete(listener);
  };
}

export function planMonthSuggestionEpoch() {
  return suggestionEpoch;
}

function ledgerStamp(
  ledger: PlanMonthPaintInput["ledgerTransactions"],
): string {
  let links = "";
  for (const tx of ledger) {
    if (!tx.linkedPlanItemId) continue;
    links += `${tx.id}:${tx.linkedPlanItemId},`;
  }
  return `${ledger.length}:${ledger[0]?.id ?? ""}:${ledger[ledger.length - 1]?.id ?? ""}:${links}`;
}

export function planMonthPaintStamp(
  input: Omit<PlanMonthPaintInput, "monthKey">,
): string {
  return [
    stampPlanItems(input.items),
    ledgerStamp(input.ledgerTransactions),
    String(input.saldoMinor ?? ""),
    input.timeZone,
  ].join("|");
}

export function readPlanMonthPaint(
  monthKey: string,
  stamp: string,
): PlanMonthPaint | null {
  const hit = paints.get(monthKey);
  if (!hit || hit.stamp !== stamp) return null;
  return hit.paint;
}

export function rememberPlanMonthPaint(
  monthKey: string,
  stamp: string,
  paint: PlanMonthPaint,
) {
  paints.set(monthKey, { stamp, paint });
}

export function readPlanMonthSuggestions(
  monthKey: string,
  stamp: string,
): PlanLinkSuggestion[] | null {
  const hit = suggestions.get(monthKey);
  if (!hit || hit.stamp !== stamp) return null;
  return hit.suggestions;
}

/** Cache lookup or a sync build — this is the visible totals + list path. */
export function ensurePlanMonthPaint(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
): PlanMonthPaint {
  const hit = readPlanMonthPaint(input.monthKey, stamp);
  if (hit) return hit;
  const paint = buildPlanMonthPaint(input);
  rememberPlanMonthPaint(input.monthKey, stamp, paint);
  return paint;
}

export function ensurePlanMonthSuggestions(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
  projection?: PlanMonthPaint["projection"],
): PlanLinkSuggestion[] {
  const hit = readPlanMonthSuggestions(input.monthKey, stamp);
  if (hit) return hit;
  const next = buildPlanMonthSuggestions(input, projection);
  suggestions.set(input.monthKey, { stamp, suggestions: next });
  emitSuggestions();
  return next;
}

export function prefetchAdjacentPlanMonths(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
): string[] {
  const keys = [
    addMonthsKey(input.monthKey, -1),
    addMonthsKey(input.monthKey, 1),
  ];
  for (const monthKey of keys) {
    const next = { ...input, monthKey };
    const paint = ensurePlanMonthPaint(next, stamp);
    ensurePlanMonthSuggestions(next, stamp, paint.projection);
  }
  return keys;
}

/**
 * Soft month switch: resolve totals + list without a network hop.
 * Adjacent months should already be in cache from prefetch.
 */
export function softSwitchPlanMonth(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
): {
  paint: PlanMonthPaint;
  elapsedMs: number;
  fromCache: boolean;
} {
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const fromCache = readPlanMonthPaint(input.monthKey, stamp) != null;
  const paint = ensurePlanMonthPaint(input, stamp);
  const ended =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return { paint, elapsedMs: ended - started, fromCache };
}

export function scheduleEnsurePlanMonthSuggestions(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
  projection?: PlanMonthPaint["projection"],
) {
  if (readPlanMonthSuggestions(input.monthKey, stamp)) return;
  const run = () => {
    ensurePlanMonthSuggestions(input, stamp, projection);
  };
  if (typeof window === "undefined") {
    run();
    return;
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 300 });
    return;
  }
  window.setTimeout(run, 1);
}

export function schedulePrefetchAdjacentPlanMonths(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
) {
  if (typeof window === "undefined") {
    prefetchAdjacentPlanMonths(input, stamp);
    return;
  }
  const run = () => {
    prefetchAdjacentPlanMonths(input, stamp);
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 300 });
    return;
  }
  window.setTimeout(run, 1);
}

export function resetPlanMonthCacheForTests() {
  paints.clear();
  suggestions.clear();
  suggestionEpoch = 0;
}
