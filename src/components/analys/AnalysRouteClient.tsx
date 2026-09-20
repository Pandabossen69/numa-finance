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
import {
  ensurePaintableAnalysSnapshot,
  scheduleUpgradeAnalysFromPlan,
} from "@/features/finance/ensure-analys-last-known";
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
  // Paint last-known / Hem-derived chrome in this render. planStored /
  // homeStored subscriptions re-render when Hem confirm or quiet-warm
  // writes — do not gate first paint on those snapshots being non-null.
  const view =
    (analysViewCanPaint(stored) ? stored : null) ??
    ensurePaintableAnalysSnapshot();

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

    if (ensurePaintableAnalysSnapshot()) {
      // Heading+Perioden already paintable (Hem-thin / last-known).
      // Defer Plan ledger categories until after first paint.
      scheduleUpgradeAnalysFromPlan();
      return;
    }

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
    const launch = () => {
      if (cancelled || ensurePaintableAnalysSnapshot()) return;
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
    };
    // Spec S2: production Flight POST must not stall heading+Perioden.
    // Empty Perioden chrome is already painted; start the action after paint.
    const scheduled =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(launch)
        : window.setTimeout(launch, 0);
    return () => {
      cancelled = true;
      if (typeof requestAnimationFrame === "function") {
        cancelAnimationFrame(scheduled);
      } else {
        window.clearTimeout(scheduled);
      }
    };
  }, [retryNonce, analysActive, planStored, homeStored]);

  return <AnalysDashboard data={view} error={error} retrying={retrying} />;
}
