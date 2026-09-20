"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { useNavIntent } from "@/components/layout/NavIntent";
import {
  ANALYS_AUTO_RETRY_BACKOFF_MS,
  analysPendingRemainingMs,
  analysViewCanPaint,
  canAnalysAutoRetry,
  fetchAnalysSnapshotClient,
  lastAnalysFetchResult,
  markAnalysAutoRetryUsed,
  markAnalysPendingStarted,
  registerAnalysClientRetry,
  resetAnalysClientFetch,
} from "@/features/finance/analys-client-fetch";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { AnalysSnapshotResult } from "@/features/finance/load-analys";
import {
  lastAnalysSnapshot,
  lastPlanSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
  subscribePlanSnapshot,
} from "@/features/home/last-snapshot";
import { spaTabKey } from "@/lib/nav/spa-tabs";
import {
  scheduleQuietMenuWarm,
  waitForQuietMenuWarm,
} from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Analys — paint last-known immediately, quiet-fetch in background.
 * A hung server action must fail-soft within ~5s, never «Hämtar analysen…» forever.
 * Production remounts the route while the action Flight POST is open; the
 * client cap and last result live at module scope so remount cannot reset them.
 *
 * Hidden keep-alive must not start a Flight POST. That raced Hem idle warm
 * and stalled the first Analys tap. Quiet-warm / Plan last-known gap-fills
 * a paint-able snapshot first; fetch only when the tab is visible and cannot
 * paint — and only after the idle Plan bundle has settled, so two TodaySnapshot
 * reads do not share the 4.5s fail-soft budget.
 */
export function AnalysRouteClient() {
  const { pathname } = useNavIntent();
  const analysActive = spaTabKey(pathname) === "/analys";
  const stored = useSyncExternalStore(
    subscribeAnalysSnapshot,
    lastAnalysSnapshot,
    lastAnalysSnapshot,
  );
  const planStored = useSyncExternalStore(
    subscribePlanSnapshot,
    lastPlanSnapshot,
    lastPlanSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const view = stored ?? (planStored ? ensurePaintableAnalysSnapshot() : null);

  useEffect(() => {
    return registerAnalysClientRetry(() => {
      resetAnalysClientFetch();
      setError(null);
      setRetrying(false);
      setRetryNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    const apply = (result: AnalysSnapshotResult) => {
      if (result.ok) {
        rememberAnalysSnapshot(result.data);
        setError(null);
        setRetrying(false);
        scheduleQuietMenuWarm();
        return;
      }
      if (ensurePaintableAnalysSnapshot()) {
        setError(null);
        return;
      }
      // Last-known that cannot paint must not swallow fail-soft — that left
      // production on «Hämtar analysen…» after the timeout.
      if (!analysViewCanPaint(lastAnalysSnapshot())) {
        setError(result.error);
      }
    };

    let cancelled = false;

    const run = async () => {
      if (ensurePaintableAnalysSnapshot()) return;

      markAnalysPendingStarted();
      scheduleQuietMenuWarm();
      await Promise.race([
        waitForQuietMenuWarm(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, analysPendingRemainingMs());
        }),
      ]);
      if (cancelled) return;
      if (ensurePaintableAnalysSnapshot()) return;

      const prior = lastAnalysFetchResult();
      if (
        prior &&
        !prior.ok &&
        !canAnalysAutoRetry() &&
        !analysViewCanPaint(lastAnalysSnapshot())
      ) {
        apply(prior);
        return;
      }

      if (!analysActive) return;

      const result = await fetchAnalysSnapshotClient(getAnalysSnapshotAction);
      if (cancelled) return;
      apply(result);

      if (
        !result.ok &&
        !ensurePaintableAnalysSnapshot() &&
        canAnalysAutoRetry()
      ) {
        markAnalysAutoRetryUsed();
        setRetrying(true);
        window.setTimeout(() => {
          if (cancelled) return;
          resetAnalysClientFetch();
          setError(null);
          setRetryNonce((value) => value + 1);
        }, ANALYS_AUTO_RETRY_BACKOFF_MS);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [retryNonce, analysActive, planStored]);

  return <AnalysDashboard data={view} error={error} retrying={retrying} />;
}
