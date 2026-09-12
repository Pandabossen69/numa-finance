"use client";

import { getQuietMenuBundleAction } from "@/features/finance/quiet-menu-bundle";
import {
  isMovementsDirty,
  lastAnalysSnapshot,
  lastMovementsSnapshot,
  lastPlanSnapshot,
  rememberAnalysSnapshot,
  rememberGettingStarted,
  rememberMovementsSnapshot,
  rememberPlanSnapshot,
  syncHomeLivingFromPlan,
} from "@/features/home/last-snapshot";

/**
 * NextStep Sales pattern: keep heavy numbers in client memory and refresh
 * quietly after first paint. Never wipe last-known on failure. Menu taps then
 * paint from cache in the same tick (LastViewOutlet / dest shells).
 */

let warmGeneration = 0;
let inflight: Promise<void> | null = null;
let scheduled = false;

function applyQuietBundle(
  generation: number,
  data: Awaited<ReturnType<typeof getQuietMenuBundleAction>>,
) {
  if (generation !== warmGeneration) return;
  if (!data.ok) return;

  const { plan, gettingStarted, analys, movements } = data.data;

  // Quiet success only fills gaps / refreshes — never clears existing UI.
  if (plan) {
    rememberPlanSnapshot(plan);
    syncHomeLivingFromPlan(plan);
  }
  if (gettingStarted) rememberGettingStarted(gettingStarted);
  if (analys) rememberAnalysSnapshot(analys);
  if (movements && !isMovementsDirty()) {
    rememberMovementsSnapshot(movements);
  }
}

async function runQuietWarm(generation: number) {
  try {
    const result = await getQuietMenuBundleAction();
    applyQuietBundle(generation, result);
  } catch {
    // Quiet: keep whatever last-known Hem already showed.
  }
}

/**
 * Warm Plan/Analys/Rörelser after Hem has (or is about to have) the wire.
 * Default: idle so Hem's first paint is not competing.
 * `urgent`: start ASAP — use after Hem session confirm so quiet warm wins
 * the keep-alive cold fetches that wait on afterHemBoot.
 */
export function scheduleQuietMenuWarm(opts?: {
  restart?: boolean;
  urgent?: boolean;
}) {
  if (typeof window === "undefined") return;
  if (opts?.restart) {
    warmGeneration += 1;
    scheduled = false;
    inflight = null;
  }
  if (scheduled && inflight) return;
  scheduled = true;

  const start = () => {
    const generation = ++warmGeneration;
    inflight = runQuietWarm(generation).finally(() => {
      if (generation === warmGeneration) inflight = null;
    });
  };

  if (opts?.urgent) {
    start();
    return;
  }
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(start, { timeout: 300 });
  } else {
    window.setTimeout(start, 50);
  }
}

/** True when dest shells can paint real money without waiting for RSC. */
export function quietMenuCacheReady() {
  return (
    lastPlanSnapshot() != null ||
    lastAnalysSnapshot() != null ||
    lastMovementsSnapshot() != null
  );
}

/** Test helper — reset module state between unit cases. */
export function resetQuietMenuWarmForTests() {
  warmGeneration = 0;
  inflight = null;
  scheduled = false;
}
