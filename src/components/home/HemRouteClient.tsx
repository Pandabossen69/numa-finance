"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { fetchHomeSnapshot } from "@/features/finance/home-snapshot-client";
import {
  isHomeDirty,
  lastGettingStarted,
  lastHomeShellSnapshot,
  lastHomeSnapshot,
  lastSessionHomeSnapshot,
  rememberHomeSnapshot,
  subscribeGettingStarted,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Hem — same NextStep pattern as Plan/Analys.
 * Session-confirmed last-known paints as live; after login, same-user
 * cached totals may paint as a provisional shell (#107 + Christian-bar).
 * Login boot clears on mount so "Loggar in…" never waits on the snapshot.
 */
export function HemRouteClient() {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeShellSnapshot,
    lastHomeShellSnapshot,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(null);

  // Drop branded login overlay as soon as Hem is in the tree.
  useLayoutEffect(() => {
    clearLoginBoot();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Live confirm already present — skip duplicate IO.
    if (lastSessionHomeSnapshot()) {
      scheduleQuietMenuWarm({ urgent: true });
      return;
    }
    void fetchHomeSnapshot().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        scheduleQuietMenuWarm({ urgent: true });
        if (!isHomeDirty()) rememberHomeSnapshot(result.data);
        setError(null);
        return;
      }
      if (!lastHomeSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stored) {
      scheduleQuietMenuWarm({ urgent: true });
    }
  }, [stored]);

  if (!stored && !error) {
    return <HemFirstPaint />;
  }

  return (
    <HomeDashboard
      snap={stored}
      error={error}
      gettingStarted={storedGettingStarted}
      adoptSnap={lastSessionHomeSnapshot() != null}
    />
  );
}
