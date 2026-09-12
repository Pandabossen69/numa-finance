"use client";

import {
  getHomeSnapshotAction,
  type HomeSnapshotResult,
} from "@/features/finance/home-snapshot";

/**
 * Coalesce concurrent Hem snapshot requests (login warm + HemRouteClient mount
 * otherwise fire two identical server actions that do not share React cache()).
 */
let inflight: Promise<HomeSnapshotResult> | null = null;

export function fetchHomeSnapshot(): Promise<HomeSnapshotResult> {
  if (!inflight) {
    inflight = getHomeSnapshotAction().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Test helper — reset module state between unit cases. */
export function resetHomeSnapshotClientForTests() {
  inflight = null;
}
