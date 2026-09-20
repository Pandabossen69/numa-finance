import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import {
  analysSnapshotFromHome,
  analysSnapshotFromPlan,
  isThinAnalysSnapshot,
} from "@/features/finance/analys-from-known";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import {
  lastAnalysSnapshot,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  rememberAnalysSnapshot,
} from "@/features/home/last-snapshot";

function homeForAnalys() {
  return lastSessionHomeSnapshot() ?? lastHomeSnapshot();
}

/**
 * Paint-able Analys from last-known, Plan+Hem, or Hem alone. Sync — dest-loading
 * and the first Analys render must not wait on useEffect or a Flight POST.
 * A thin Hem stub is upgraded when Plan is richer; an already paint-able
 * last-known is never rebuilt just because Plan warmed again.
 */
export function ensurePaintableAnalysSnapshot(): AnalysSnapshot | null {
  const existing = lastAnalysSnapshot();
  const plan = lastPlanSnapshot();
  const home = homeForAnalys();

  if (plan) {
    const derived = analysSnapshotFromPlan(plan, home);
    if (analysViewCanPaint(derived)) {
      const shouldUpgrade =
        !analysViewCanPaint(existing) ||
        (isThinAnalysSnapshot(existing) && !isThinAnalysSnapshot(derived));
      if (shouldUpgrade) {
        rememberAnalysSnapshot(derived);
        return derived;
      }
    }
  }

  if (analysViewCanPaint(existing)) return existing;

  if (home) {
    const derived = analysSnapshotFromHome(home);
    if (analysViewCanPaint(derived)) {
      rememberAnalysSnapshot(derived);
      return derived;
    }
  }

  return null;
}
