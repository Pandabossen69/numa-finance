"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { useNavIntent } from "@/components/layout/NavIntent";
import {
  ANALYS_AUTO_RETRY_BACKOFF_MS,
  analysViewCanPaint,
  canAnalysAutoRetry,
  fetchAnalysSnapshotClient,
  lastAnalysFetchResult,
  markAnalysAutoRetryUsed,
  registerAnalysClientRetry,
  resetAnalysClientFetch,
} from "@/features/finance/analys-client-fetch";
import { getAnalysSnapshotAction } from "@/features/finance/analys-snapshot";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { AnalysSnapshotResult } from "@/features/finance/load-analys";
import {
  lastAnalysSnapshot,
  lastHomeSnapshot,
  lastPlanSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
  subscribeHomeSnapshot,
  subscribePlanSnapshot,
} from "@/features/home/last-snapshot";
import { spaTabKey } from "@/lib/nav/spa-tabs";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Analys — paint last-known in the same tick as the tap.
 * Time-to-first-paint is last-known / Hem-derived chrome, never fetch-done.
 * A hung server action must fail-soft within ~5s, never «Hämtar analysen…» forever.
 *
 * Hidden keep-alive must not start a Flight POST. Quiet-warm / Hem last-known
 * gap-fills a paint-able snapshot as soon as Hem confirms; fetch only when the
 * tab is visible and still cannot paint.
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
  const homeStored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    lastHomeSnapshot,
  );
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const view =
    stored ??
    (planStored || homeStored ? ensurePaintableAnalysSnapshot() : null);

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
      if (!analysViewCanPaint(lastAnalysSnapshot())) {
        setError(result.error);
      }
    };

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

    let cancelled = false;
    void fetchAnalysSnapshotClient(getAnalysSnapshotAction).then((result) => {
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
    });
    return () => {
      cancelled = true;
    };
  }, [retryNonce, analysActive, planStored, homeStored]);

  return <AnalysDashboard data={view} error={error} retrying={retrying} />;
}
