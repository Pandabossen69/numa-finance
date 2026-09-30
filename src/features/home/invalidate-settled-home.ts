import { clearPlanMonthCache } from "@/features/plan/plan-month-cache";
import { writeLastHomeCookie } from "@/features/home/last-home-cookie";
import {
  readPersistedLastKnown,
  writePersistedLastKnown,
} from "@/features/home/last-snapshot-persist";

/**
 * Settle, unsettle and edit-settled must not leave Hem on the pre-settle
 * cookie / localStorage shell or a stale plan-month paint.
 *
 * Clears `numa.lastHome.v1` and the home field inside `numa.lastKnown.v1`,
 * drops the plan-month cache, and bumps an epoch so Hem refetches and
 * recomputes instead of painting the old På kontona / Kvar idag / periodrad.
 */
let epoch = 0;
const listeners = new Set<() => void>();

export function settledHomeEpoch(): number {
  return epoch;
}

export function subscribeSettledHomeEpoch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateSettledHomeSurfaces(): number {
  clearPlanMonthCache();
  const persisted = readPersistedLastKnown();
  if (persisted) {
    writePersistedLastKnown({ ...persisted, home: null });
  } else {
    writeLastHomeCookie(null);
  }
  epoch += 1;
  for (const listener of listeners) listener();
  return epoch;
}

export function resetSettledHomeEpochForTests(): void {
  epoch = 0;
  listeners.clear();
}
