"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { useNavIntent } from "@/components/layout/NavIntent";
import { analysSnapshotFromPlan } from "@/features/finance/analys-from-known";
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
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  rememberAnalysSnapshot,
  subscribeAnalysSnapshot,
  subscribePlanSnapshot,
} from "@/features/home/last-snapshot";
import { spaTabKey } from "@/lib/nav/spa-tabs";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/**
 * Client-first Analys — paint last-known immediately, quiet-fetch in background.
 * A hung server action must fail-soft within ~5s, never «Hämtar analysen…» forever.
 * Production remounts the route while the action Flight POST is open; the
 * client cap and last result live at module scope so remount cannot reset them.
 *
 * Hidden keep-alive must not start a Flight POST. That raced Hem idle warm
 * and stalled the first Analys tap. Quiet-warm / Plan last-known gap-fills
 * a paint-able snapshot first; fetch only when the tab is visible and cannot
 * paint.
 */
function gapFillAnalysFromPlan(): boolean {
  if (analysViewCanPaint(lastAnalysSnapshot())) return true;
  const plan = lastPlanSnapshot();
  if (!plan) return false;
  const derived = analysSnapshotFromPlan(plan, lastSessionHomeSnapshot());
  if (!analysViewCanPaint(derived)) return false;
  rememberAnalysSnapshot(derived);
  return true;
}

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
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    return registerAnalysClientRetry(() => {
      resetAnalysClientFetch();
      setError(null);
      setRetryNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    gapFillAnalysFromPlan();

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

    if (analysViewCanPaint(lastAnalysSnapshot())) return;

    const prior = lastAnalysFetchResult();
    if (prior && !prior.ok && !analysViewCanPaint(lastAnalysSnapshot())) {
      apply(prior);
      return;
    }

    if (!analysActive) return;

    let cancelled = false;
    void fetchAnalysSnapshotClient(getAnalysSnapshotAction).then((result) => {
      if (cancelled) return;
      apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [retryNonce, analysActive, planStored]);

  return <AnalysDashboard data={stored} error={error} />;
}
