"use client";

import {
  isHomeSessionConfirmed,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

/** Fail-open so Plan/Analys/Rörelser are not stuck if Hem errors out. */
export const AFTER_HEM_BOOT_FAIL_OPEN_MS = 2_500;

/**
 * Run cold menu fetches only after Hem session paint is confirmed (or fail-open).
 * Keep-alive mounts all tabs at once — without this gate they thundering-herd
 * the same TodaySnapshot work and stretch login→Hem to multi-second waits.
 *
 * After confirm we idle briefly so urgent `scheduleQuietMenuWarm` (started in
 * the same turn as rememberHomeSnapshot) can fill Plan/Analys/Rörelser first;
 * route clients then no-op when last*Snapshot() is already set.
 */
export function afterHemBoot(run: () => void): () => void {
  if (typeof window === "undefined") {
    run();
    return () => {};
  }
  if (isHomeSessionConfirmed()) {
    run();
    return () => {};
  }

  let cancelled = false;
  let finished = false;
  let idleId: number | null = null;
  let idleTimer: number | null = null;

  const kick = () => {
    idleId = null;
    idleTimer = null;
    if (cancelled) return;
    run();
  };

  const finish = () => {
    if (cancelled || finished) return;
    finished = true;
    window.clearTimeout(failOpen);
    unsub();
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(kick, { timeout: 450 });
    } else {
      idleTimer = window.setTimeout(kick, 80);
    }
  };

  const unsub = subscribeHomeSnapshot(() => {
    if (isHomeSessionConfirmed()) finish();
  });
  const failOpen = window.setTimeout(finish, AFTER_HEM_BOOT_FAIL_OPEN_MS);

  return () => {
    cancelled = true;
    finished = true;
    window.clearTimeout(failOpen);
    if (idleTimer != null) window.clearTimeout(idleTimer);
    if (idleId != null && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(idleId);
    }
    unsub();
  };
}
