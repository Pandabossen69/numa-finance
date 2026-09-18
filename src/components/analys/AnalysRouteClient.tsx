"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { fetchAnalysSnapshotClient } from "@/features/finance/analys-client-fetch";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import {
  lastAnalysSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Analys — paint last-known immediately, quiet-fetch in background.
 * A hung server action must fail-soft within ~5s, never «Hämtar analysen…» forever.
 */
export function AnalysRouteClient() {
  const stored = useSyncExternalStore(
    subscribeAnalysSnapshot,
    lastAnalysSnapshot,
    () => null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Always fetch under the client cap. Last-known paints immediately;
    // a hung action must still fail-soft so reload never sits on pending.
    void fetchAnalysSnapshotClient(getAnalysSnapshotAction).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        rememberAnalysSnapshot(result.data);
        setError(null);
        scheduleQuietMenuWarm();
        return;
      }
      if (!lastAnalysSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <AnalysDashboard data={stored} error={error} />;
}
