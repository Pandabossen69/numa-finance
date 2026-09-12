"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { fetchHomeSnapshot } from "@/features/finance/home-snapshot-client";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  isHomeDirty,
  lastGettingStarted,
  lastHomeShellSnapshot,
  lastHomeSnapshot,
  lastSessionHomeSnapshot,
  rememberHomeSnapshot,
  seedHomeLoginShell,
  subscribeGettingStarted,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Hem — same NextStep pattern as Plan/Analys.
 * Session-confirmed last-known paints as live; after login, same-user
 * cached totals may paint as a provisional shell (#107 + Christian-bar).
 * Login boot clears on mount so "Loggar in…" never waits on the snapshot.
 * Optional cookieShell lets hard-refresh SSR paint last-known in first HTML.
 */
export function HemRouteClient({
  cookieShell = null,
}: {
  cookieShell?: HomeSnapshot | null;
}) {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    () => lastHomeShellSnapshot() ?? cookieShell,
    () => cookieShell,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(null);

  // Drop branded login overlay + seed cookie into provisional shell.
  useLayoutEffect(() => {
    clearLoginBoot();
    seedHomeLoginShell(cookieShell);
  }, [cookieShell]);

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

  const snap = stored ?? cookieShell;
  if (!snap && !error) {
    return <HemFirstPaint cookieShell={cookieShell} />;
  }

  return (
    <HomeDashboard
      snap={snap}
      error={error}
      gettingStarted={storedGettingStarted}
      adoptSnap={lastSessionHomeSnapshot() != null}
    />
  );
}
