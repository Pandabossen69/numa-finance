"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { serverNull, serverZero } from "@/lib/react/server-snapshot";
import {
  settledHomeEpoch,
  subscribeSettledHomeEpoch,
} from "@/features/home/invalidate-settled-home";

/**
 * Client-first Hem — same NextStep pattern as Plan/Analys.
 * Session-confirmed last-known paints immediately; hydrate alone shows
 * HemPending until the quiet fetch confirms. Optional cookieShell lets
 * hard-refresh SSR paint last-known Kvar/Över in the first HTML (SPEC 6b).
 * SPA keep-alive mounts this once so tab switches never remount or re-await RSC.
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
    serverNull,
  );
  const [error, setError] = useState<string | null>(null);
  const settleEpoch = useSyncExternalStore(
    subscribeSettledHomeEpoch,
    settledHomeEpoch,
    serverZero,
  );
  const seenSettleEpoch = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const epochAtStart = settleEpoch;
    const force =
      epochAtStart > 0 && epochAtStart !== seenSettleEpoch.current;
    void getHomeSnapshotAction().then((result) => {
      if (cancelled || settledHomeEpoch() !== epochAtStart) return;
      if (result.ok) {
        if (force || !isHomeDirty()) {
          rememberHomeSnapshot(
            result.data,
            force ? { force: true } : undefined,
          );
        }
        seenSettleEpoch.current = epochAtStart;
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
  }, [settleEpoch]);

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
