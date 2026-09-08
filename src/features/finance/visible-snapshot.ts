import { isPlaceholderEmptyRevision } from "@/lib/store/empty-snapshot";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { PlanSnapshot } from "@/features/finance/load-plan";

/** Prefer confirmed server truth; keep last-known rows over a placeholder. */
export function resolveVisiblePlanSnapshot(
  stored: PlanSnapshot | null | undefined,
  incoming: PlanSnapshot | null | undefined,
): PlanSnapshot | null {
  const storedCount = stored?.items.length ?? 0;
  const incomingCount = incoming?.items.length ?? 0;
  if (incomingCount > storedCount) return incoming ?? null;
  if (incoming && !isPlaceholderEmptyRevision(incoming.financeRevision)) {
    return incoming;
  }
  if (storedCount > 0) return stored ?? null;
  return incoming ?? stored ?? null;
}

/**
 * Paint Plan rows only when we have history, or the server finished and
 * confirmed the account is actually empty. Dest-shell / timeout must not
 * render `items=[]` — that looks like August and September vanished.
 */
export function canPaintPlanHistory(
  payload: PlanSnapshot | null,
  incoming: PlanSnapshot | null | undefined,
  incomingError: string | null | undefined,
): boolean {
  if ((payload?.items.length ?? 0) > 0) return true;
  if (incoming && !incomingError) return true;
  return false;
}

export function resolveVisibleAnalysSnapshot(
  stored: AnalysSnapshot | null | undefined,
  incoming: AnalysSnapshot | null | undefined,
): AnalysSnapshot | null {
  const storedCount = stored?.planItems.length ?? 0;
  const incomingCount = incoming?.planItems.length ?? 0;
  if (incomingCount > storedCount) return incoming ?? null;
  if (incoming && !isPlaceholderEmptyRevision(incoming.financeRevision)) {
    return incoming;
  }
  if (storedCount > 0) return stored ?? null;
  return incoming ?? stored ?? null;
}

export function canPaintAnalysHistory(
  view: AnalysSnapshot | null,
  incoming: AnalysSnapshot | null | undefined,
  incomingError: string | null | undefined,
): boolean {
  if ((view?.planItems.length ?? 0) > 0) return true;
  if ((view?.ledgerTransactions.length ?? 0) > 0) return true;
  if (incoming && !incomingError) return true;
  return false;
}
