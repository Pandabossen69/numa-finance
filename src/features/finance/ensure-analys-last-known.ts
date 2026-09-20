import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { analysSnapshotFromPlan } from "@/features/finance/analys-from-known";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import {
  lastAnalysSnapshot,
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  rememberAnalysSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Paint-able Analys from last-known or Plan + Hem. Sync — dest-loading and
 * the first Analys render must not wait on useEffect or a Flight POST.
 */
export function ensurePaintableAnalysSnapshot(): AnalysSnapshot | null {
  const existing = lastAnalysSnapshot();
  if (analysViewCanPaint(existing)) return existing;
  const plan = lastPlanSnapshot();
  if (!plan) return null;
  const derived = analysSnapshotFromPlan(plan, lastSessionHomeSnapshot());
  if (!analysViewCanPaint(derived)) return null;
  rememberAnalysSnapshot(derived);
  return derived;
}
