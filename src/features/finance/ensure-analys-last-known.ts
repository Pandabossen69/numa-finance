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
 * Paint-able Analys chrome for the tap tick. Hem-thin / existing last-known
 * only — never project Plan ledger FX + classified windows here. Qualityltf
 * ledgers take seconds; heading+Perioden must paint within ~300ms.
 * Full categories upgrade via scheduleUpgradeAnalysFromPlan after paint.
 */
export function ensurePaintableAnalysSnapshot(): AnalysSnapshot | null {
  const existing = lastAnalysSnapshot();
  if (analysViewCanPaint(existing)) return existing;

  const home = homeForAnalys();
  if (home) {
    const derived = analysSnapshotFromHome(home);
    if (analysViewCanPaint(derived)) {
      rememberAnalysSnapshot(derived);
      return lastAnalysSnapshot() ?? derived;
    }
  }

  return analysViewCanPaint(existing) ? existing : null;
}

let upgradeScheduled = false;

/**
 * After heading+Perioden paint, upgrade a Hem-thin stub from Plan ledger.
 * Idle / rAF — never on the tap tick.
 */
export function scheduleUpgradeAnalysFromPlan() {
  if (typeof window === "undefined") return;
  if (upgradeScheduled) return;
  const plan = lastPlanSnapshot();
  const existing = lastAnalysSnapshot();
  if (!plan) return;
  if (analysViewCanPaint(existing) && !isThinAnalysSnapshot(existing)) return;
  upgradeScheduled = true;

  const run = () => {
    upgradeScheduled = false;
    const current = lastAnalysSnapshot();
    const nextPlan = lastPlanSnapshot();
    if (!nextPlan) return;
    if (analysViewCanPaint(current) && !isThinAnalysSnapshot(current)) return;
    const derived = analysSnapshotFromPlan(nextPlan, homeForAnalys());
    if (!analysViewCanPaint(derived)) return;
    const shouldUpgrade =
      !analysViewCanPaint(current) ||
      (isThinAnalysSnapshot(current) && !isThinAnalysSnapshot(derived));
    if (shouldUpgrade) rememberAnalysSnapshot(derived);
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 1_200 });
  } else if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    window.setTimeout(run, 0);
  }
}

/** Test helper — allow another idle upgrade after a case mutates last-known. */
export function resetAnalysPlanUpgradeForTests() {
  upgradeScheduled = false;
}
