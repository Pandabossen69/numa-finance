"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import {
  analysViewCanPaint,
  fetchAnalysSnapshotClient,
  lastAnalysFetchResult,
  registerAnalysClientRetry,
  resetAnalysClientFetch,
} from "@/features/finance/analys-client-fetch";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import type { AnalysSnapshotResult } from "@/features/finance/load-analys";
import {
  lastAnalysSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Analys — paint last-known immediately, quiet-fetch in background.
 * A hung server action must fail-soft within ~5s, never «Hämtar analysen…» forever.
 * Production remounts the route while the action Flight POST is open; the
 * client cap and last result live at module scope so remount cannot reset them.
 */
export function AnalysRouteClient() {
  const stored = useSyncExternalStore(
    subscribeAnalysSnapshot,
    lastAnalysSnapshot,
    () => null,
  );
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    return registerAnalysClientRetry(() => {
      resetAnalysClientFetch();
      setError(null);
      setRetryNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    const apply = (result: AnalysSnapshotResult) => {
      if (result.ok) {
        rememberAnalysSnapshot(result.data);
        setError(null);
        scheduleQuietMenuWarm();
        return;
      }
      // Last-known that cannot paint must not swallow fail-soft — that left
      // production on «Hämtar analysen…» after the timeout.
      if (!analysViewCanPaint(lastAnalysSnapshot())) {
        setError(result.error);
      }
    };

    const prior = lastAnalysFetchResult();
    if (prior && !prior.ok && !analysViewCanPaint(lastAnalysSnapshot())) {
      apply(prior);
      return;
    }

    let cancelled = false;
    void fetchAnalysSnapshotClient(getAnalysSnapshotAction).then((result) => {
      if (cancelled) return;
      apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

  return <AnalysDashboard data={stored} error={error} />;
}
