"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getPlanPageDataAction } from "@/components/plan/load-plan";
import { PlanScreen } from "@/components/plan/PlanScreen";
import {
  lastGettingStarted,
  lastPlanSnapshot,
  rememberGettingStarted,
  rememberPlanSnapshot,
  subscribeGettingStarted,
  subscribePlanSnapshot,
  syncHomeLivingFromPlan,
} from "@/features/home/last-snapshot";

/**
 * Client-first Plan — paint last-known immediately, quiet-fetch in background.
 * Matches NextStep Sales: menu never waits on the heavy snapshot round-trip.
 */
export function PlanRouteClient({
  focusAdd = null,
  stepHint = null,
}: {
  focusAdd?: null | "income" | "fixed";
  stepHint?: string | null;
}) {
  const stored = useSyncExternalStore(
    subscribePlanSnapshot,
    lastPlanSnapshot,
    lastPlanSnapshot,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPlanPageDataAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const { gettingStarted, ...plan } = result.data;
        rememberPlanSnapshot(plan);
        syncHomeLivingFromPlan(plan);
        if (gettingStarted) rememberGettingStarted(gettingStarted);
        setError(null);
        return;
      }
      if (!lastPlanSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PlanScreen
      focusAdd={focusAdd}
      stepHint={stepHint}
      initial={stored}
      initialError={error}
      initialGettingStarted={storedGettingStarted}
    />
  );
}
