"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import {
  lastAnalysSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
} from "@/features/home/last-snapshot";
import { afterHemBoot } from "@/lib/nav/after-hem-boot";

/**
 * Client-first Analys — paint last-known immediately, quiet-fetch in background.
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
    // Quiet menu warm owns background refresh when cache is warm.
    if (lastAnalysSnapshot()) return;
    const stop = afterHemBoot(() => {
      if (cancelled || lastAnalysSnapshot()) return;
      void getAnalysSnapshotAction().then((result) => {
        if (cancelled) return;
        if (result.ok) {
          rememberAnalysSnapshot(result.data);
          setError(null);
          return;
        }
        if (!lastAnalysSnapshot()) setError(result.error);
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return <AnalysDashboard data={stored} error={error} />;
}
