"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
import {
  isHomeDirty,
  lastGettingStarted,
  lastHomeSnapshot,
  rememberHomeSnapshot,
  subscribeGettingStarted,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Hem — same NextStep pattern as Plan/Analys.
 * Last-known paints immediately; quiet fetch catches up. SPA keep-alive
 * mounts this once so tab switches never remount or re-await RSC.
 */
export function HemRouteClient() {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    lastHomeSnapshot,
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
        return;
      }
      if (!lastHomeSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stored) scheduleQuietMenuWarm();
  }, [stored]);

  if (!stored && !error) {
    return <HemFirstPaint />;
  }

  return (
    <HomeDashboard
      snap={stored}
      error={error}
      gettingStarted={storedGettingStarted}
    />
  );
}
