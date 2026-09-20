"use client";

import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import { analysClientFetchInflight } from "@/features/finance/analys-client-fetch";
import { analysSnapshotHasDatapaint } from "@/features/finance/analys-from-known";
import {
  ensurePaintableAnalysSnapshot,
  scheduleUpgradeAnalysFromPlan,
} from "@/features/finance/ensure-analys-last-known";
import { getMerSnapshotAction } from "@/features/finance/mer-snapshot";
import { getQuietMenuBundleAction } from "@/features/finance/quiet-menu-bundle";
import {
  adoptAccountsLastKnown,
  ensurePaintableMerSnapshot,
  isAccountsDirty,
  isMovementsDirty,
  lastAnalysSnapshot,
  lastMerSnapshot,
  lastMovementsSnapshot,
  lastPlanSnapshot,
  paintableAccountsSnapshot,
  rememberAnalysSnapshot,
  rememberGettingStarted,
  rememberMerSnapshot,
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
let warmCompleted = false;
let warmWaiters: Array<() => void> = [];
let quietAnalysStarted = false;
let quietMerStarted = false;

function settleWarmWaiters() {
  const waiters = warmWaiters;
  warmWaiters = [];
  for (const waiter of waiters) waiter();
}

function applyQuietBundle(
  generation: number,
  data: Awaited<ReturnType<typeof getQuietMenuBundleAction>>,
) {
  if (generation !== warmGeneration) return;
  if (!data.ok) return;

  const { plan, gettingStarted, analys, movements, accounts, mer } = data.data;

  // Quiet success only fills gaps / refreshes — never clears existing UI.
  // Spec S2: write Analys last-known before Konton adopt so a stale-accounts
  // invalidate cannot leave heading+Perioden waiting on getAnalysSnapshotAction.
  if (plan) {
    rememberPlanSnapshot(plan);
    syncHomeLivingFromPlan(plan);
  }
  ensurePaintableAnalysSnapshot();
  // Quiet-warm Plan already has the ledger. First-bars from that partial —
  // do not wait for a second getAnalysSnapshotAction Flight (~13s warm).
  scheduleUpgradeAnalysFromPlan();
  if (gettingStarted) rememberGettingStarted(gettingStarted);
  if (analys && lastAnalysSnapshot() == null) {
    rememberAnalysSnapshot(analys);
  }
  if (movements && !isMovementsDirty()) {
    rememberMovementsSnapshot(movements);
  }
  // Spec S: gap-fill only when incoming agrees with Hem and is not poorer
  // than a richer last-known. Stale/incomplete last-known is dropped so
  // Konton refetches instead of painting Sept-11 ~9k over Hem ~3450.
  // Konton-only — must not clear or block Spec R Analys last-known.
  if (!isAccountsDirty()) {
    adoptAccountsLastKnown(accounts);
  }
  ensurePaintableAnalysSnapshot();
  // Spec P2.3b: seed Mer hub last-known so dest chrome paints same-tick.
  // Bundle mer is authoritative (profile + isAdmin). Otherwise gap-fill
  // from Hem — never clear an existing last-known.
  if (mer) rememberMerSnapshot(mer);
  ensurePaintableMerSnapshot();
}

function scheduleQuietAnalysRefresh() {
  if (typeof window === "undefined") return;
  if (quietAnalysStarted) return;
  if (analysClientFetchInflight()) return;
  quietAnalysStarted = true;

  const start = () => {
    if (analysClientFetchInflight()) {
      quietAnalysStarted = false;
      return;
    }
    if (analysSnapshotHasDatapaint(lastAnalysSnapshot())) return;
    void getAnalysSnapshotAction()
      .then((result) => {
        if (result.ok) rememberAnalysSnapshot(result.data);
      })
      .catch(() => {
        quietAnalysStarted = false;
      });
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(start, { timeout: 1_200 });
  } else {
    window.setTimeout(start, 200);
  }
}

function scheduleQuietMerRefresh() {
  if (typeof window === "undefined") return;
  if (quietMerStarted) return;
  quietMerStarted = true;

  const start = () => {
    void getMerSnapshotAction()
      .then((result) => {
        if (result.ok) rememberMerSnapshot(result.data);
      })
      .catch(() => {
        quietMerStarted = false;
      });
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(start, { timeout: 1_200 });
  } else {
    window.setTimeout(start, 200);
  }
}

async function runQuietWarm(generation: number) {
  try {
    const result = await getQuietMenuBundleAction();
    applyQuietBundle(generation, result);
    if (generation === warmGeneration) {
      scheduleQuietAnalysRefresh();
      scheduleQuietMerRefresh();
    }
  } catch {
    // Quiet: keep whatever last-known Hem already showed.
  }
}

/** Idle warm so Hem's first paint is not competing with Plan/Analys/Rörelser. */
export function scheduleQuietMenuWarm(opts?: { restart?: boolean }) {
  if (typeof window === "undefined") return;
  if (opts?.restart) {
    warmGeneration += 1;
    scheduled = false;
    inflight = null;
    warmCompleted = false;
    quietAnalysStarted = false;
    quietMerStarted = false;
    settleWarmWaiters();
  }
  if (inflight) return;
  if (scheduled && !warmCompleted) return;
  scheduled = true;
  warmCompleted = false;

  const start = () => {
    const generation = ++warmGeneration;
    inflight = runQuietWarm(generation).finally(() => {
      if (generation === warmGeneration) {
        inflight = null;
        warmCompleted = true;
        settleWarmWaiters();
      }
    });
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(start, { timeout: 300 });
  } else {
    window.setTimeout(start, 50);
  }
}

/**
 * Resolves when the idle Plan/Rörelser bundle has applied (or was never
 * scheduled). Analys must wait for this before starting its own TodaySnapshot
 * so two fat reads do not share the 4.5s fail-soft budget.
 */
export function waitForQuietMenuWarm(): Promise<void> {
  if (inflight) return inflight;
  if (warmCompleted || !scheduled) return Promise.resolve();
  return new Promise((resolve) => {
    warmWaiters.push(resolve);
  });
}

/** True when dest shells can paint real money without waiting for RSC. */
export function quietMenuCacheReady() {
  return (
    lastPlanSnapshot() != null ||
    lastAnalysSnapshot() != null ||
    lastMovementsSnapshot() != null ||
    paintableAccountsSnapshot() != null ||
    lastMerSnapshot() != null
  );
}

/** Test helper — reset module state between unit cases. */
export function resetQuietMenuWarmForTests() {
  warmGeneration = 0;
  inflight = null;
  scheduled = false;
  warmCompleted = false;
  quietAnalysStarted = false;
  quietMerStarted = false;
  settleWarmWaiters();
}

/** Test helper — apply a bundle as idle warm would. */
export function applyQuietMenuBundleForTests(
  data: Awaited<ReturnType<typeof getQuietMenuBundleAction>>,
) {
  applyQuietBundle(warmGeneration, data);
}
