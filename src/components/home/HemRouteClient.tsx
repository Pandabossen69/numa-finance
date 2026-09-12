"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { fetchHomeSnapshot } from "@/features/finance/home-snapshot-client";
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
 * Session-confirmed last-known paints immediately; hydrate alone shows a
 * Hem-shaped skeleton until the quiet fetch confirms (#107). Login boot
 * clears on shell mount so "Loggar in…" never waits on the snapshot.
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

  // Drop branded login overlay as soon as Hem is in the tree — money may
  // still be fetching; skeleton/shell is the Christian-bar usable paint.
  useLayoutEffect(() => {
    clearLoginBoot();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Login warm may already have confirmed — paint stays, skip duplicate IO.
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
    <HomeDashboard snap={stored} error={error} gettingStarted={storedGettingStarted} />
  );
}
