"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
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
 * Session-confirmed last-known paints immediately; hydrate alone shows
 * HemPending until the quiet fetch confirms. SPA keep-alive mounts this
 * once so tab switches never remount or re-await RSC.
 */
export function HemRouteClient() {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastSessionHomeSnapshot,
    lastSessionHomeSnapshot,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(null);

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

  if (!stored && !error) {
    return <HemFirstPaint />;
  }

  return (
    <HomeDashboard snap={stored} error={error} gettingStarted={storedGettingStarted} />
  );
}
