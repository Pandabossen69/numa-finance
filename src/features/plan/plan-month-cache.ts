import { addMonthsKey, type PlanLinkSuggestion } from "@/domain/finance";
import { stampPlanItems } from "@/features/plan/optimistic";
import {
  buildPlanMonthChrome,
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
const paintListeners = new Set<() => void>();
let suggestionEpoch = 0;
let paintEpoch = 0;
let lastPaint: PlanMonthPaint | null = null;

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

function emitPaints() {
  paintEpoch += 1;
  for (const listener of paintListeners) listener();
}

export function subscribePlanMonthPaints(listener: () => void) {
  paintListeners.add(listener);
  return () => {
    paintListeners.delete(listener);
  };
}

export function planMonthPaintEpoch() {
  return paintEpoch;
}

export function lastPlanMonthPaint(): PlanMonthPaint | null {
  return lastPaint;
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
  lastPaint = paint;
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

/**
 * Chrome tick: dest cache, else last-known keep-shell, else a cheap stub.
 * Never project dest coverage on this path — that is datapaint.
 */
export function resolvePlanMonthPaint(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
  opts?: { allowBuild?: boolean },
): { paint: PlanMonthPaint; ready: boolean; fromCache: boolean } {
  const hit = readPlanMonthPaint(input.monthKey, stamp);
  if (hit) return { paint: hit, ready: true, fromCache: true };

  const last = lastPlanMonthPaint();
  if (last && last.monthKey !== input.monthKey) {
    return { paint: last, ready: false, fromCache: false };
  }

  if (opts?.allowBuild === false) {
    return {
      paint: last ?? buildPlanMonthChrome(input.monthKey, input.saldoMinor),
      ready: false,
      fromCache: false,
    };
  }

  return {
    paint: ensurePlanMonthPaint(input, stamp),
    ready: true,
    fromCache: false,
  };
}

function scheduleAfterChrome(run: () => void) {
  if (typeof window === "undefined") {
    run();
    return;
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
      } else {
        run();
      }
    });
    return;
  }
  window.setTimeout(run, 0);
}

/** Dest datapaint after the month-nav chrome frame. Double-rAF like Analys S2. */
export function scheduleEnsurePlanMonthPaint(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
) {
  if (readPlanMonthPaint(input.monthKey, stamp)) return;
  scheduleAfterChrome(() => {
    if (readPlanMonthPaint(input.monthKey, stamp)) return;
    ensurePlanMonthPaint(input, stamp);
    emitPaints();
  });
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
 * Soft month switch chrome: dest cache or last-known shell, no dest project.
 * Adjacent warm months stay a cache hit. Cold dest datapaint is scheduled.
 */
export function softSwitchPlanMonth(
  input: PlanMonthPaintInput,
  stamp = planMonthPaintStamp(input),
): {
  paint: PlanMonthPaint;
  elapsedMs: number;
  fromCache: boolean;
  ready: boolean;
} {
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const resolved = resolvePlanMonthPaint(input, stamp, { allowBuild: false });
  const ended =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!resolved.ready) {
    scheduleEnsurePlanMonthPaint(input, stamp);
  }
  return { ...resolved, elapsedMs: ended - started };
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
  paintEpoch = 0;
  lastPaint = null;
}
