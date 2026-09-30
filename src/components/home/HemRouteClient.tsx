"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  isHomeDirty,
  lastGettingStarted,
  lastHomeSnapshot,
  lastSessionHomeSnapshot,
  rememberHomeSnapshot,
  subscribeGettingStarted,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Hem — same NextStep pattern as Plan/Analys.
 * Session-confirmed last-known paints immediately; cookie SSR paints as a
 * shell (adoptSnap false). Cookie-miss shows HemPending without holding
 * LoginBoot (SPEC H). Optional cookieShell lets hard-refresh SSR paint
 * last-known Kvar/Över in the first HTML (SPEC 6b). SPA keep-alive mounts
 * this once so tab switches never remount or re-await RSC.
 */
export function HemRouteClient({
  cookieShell = null,
}: {
  cookieShell?: HomeSnapshot | null;
} = {}) {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    () => lastSessionHomeSnapshot() ?? cookieShell,
    () => cookieShell,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Last-known cookie shell or HemPending is visible — do not hold
    // LoginBoot for the live snapshot (SPEC H; layout snapshot await ~23s).
    clearLoginBoot();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getHomeSnapshotAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        if (!isHomeDirty()) rememberHomeSnapshot(result.data);
        setError(null);
        scheduleQuietMenuWarm();
        clearLoginBoot();
        return;
      }
      if (!lastHomeSnapshot()) setError(result.error);
      clearLoginBoot();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stored) {
      scheduleQuietMenuWarm();
      clearLoginBoot();
    }
  }, [stored]);

  const snap = stored ?? cookieShell;
  if (!snap && !error) {
    return <HemFirstPaint />;
  }

  // Cookie-only shell must not elevate to session-confirmed (issue 107). Live
  // fetch rememberHomeSnapshot confirms; until then adoptSnap stays false when
  // the only paint source is the SSR cookie.
  const live = lastSessionHomeSnapshot() != null;
  return (
    <HomeDashboard
      snap={snap}
      error={error}
      gettingStarted={storedGettingStarted}
      adoptSnap={live}
    />
  );
}
