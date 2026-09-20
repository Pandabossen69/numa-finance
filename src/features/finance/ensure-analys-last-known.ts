import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import {
  analysSnapshotFirstBarsFromPlan,
  analysSnapshotFromHome,
  analysSnapshotHasDatapaint,
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
 * First bars upgrade via scheduleUpgradeAnalysFromPlan after paint.
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
 * After heading+Perioden paint, upgrade Hem-thin → first bars from Plan.
 * Double-rAF so the chrome frame commits first. Never the tap tick, never
 * full-history FX, never Flight.
 */
export function scheduleUpgradeAnalysFromPlan() {
  if (typeof window === "undefined") return;
  if (upgradeScheduled) return;
  const plan = lastPlanSnapshot();
  const existing = lastAnalysSnapshot();
  if (!plan) return;
  if (analysSnapshotHasDatapaint(existing)) return;
  upgradeScheduled = true;

  const run = () => {
    upgradeAnalysFromPlanNow();
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(run);
      } else {
        run();
      }
    });
  } else {
    window.setTimeout(run, 0);
  }
}

function shouldRememberDatapaint(
  current: AnalysSnapshot | null,
  derived: AnalysSnapshot,
): boolean {
  if (!analysViewCanPaint(derived)) return false;
  if (!analysSnapshotHasDatapaint(derived)) return false;
  if (!analysViewCanPaint(current)) return true;
  return isThinAnalysSnapshot(current) || !analysSnapshotHasDatapaint(current);
}

/**
 * Sync first-bars from Plan already in memory. Call after chrome paint or
 * from tests — never from ensurePaintableAnalysSnapshot.
 */
export function upgradeAnalysFromPlanNow() {
  upgradeScheduled = false;
  const current = lastAnalysSnapshot();
  const nextPlan = lastPlanSnapshot();
  if (!nextPlan) return current;
  if (analysSnapshotHasDatapaint(current)) return current;
  const derived = analysSnapshotFirstBarsFromPlan(nextPlan, homeForAnalys());
  if (shouldRememberDatapaint(current, derived)) {
    rememberAnalysSnapshot(derived);
    return lastAnalysSnapshot() ?? derived;
  }
  return current;
}

/** Test helper — allow another idle upgrade after a case mutates last-known. */
export function resetAnalysPlanUpgradeForTests() {
  upgradeScheduled = false;
}
