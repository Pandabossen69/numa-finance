"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
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
import { afterHemBoot } from "@/lib/nav/after-hem-boot";

function planFocusFromSteg(steg: string | null): {
  focusAdd: null | "income" | "fixed";
  stepHint: string | null;
} {
  if (steg === "inkomst") {
    return {
      focusAdd: "income",
      stepHint: "Här lägger du in det som kommer in.",
    };
  }
  if (steg === "utgift") {
    return {
      focusAdd: "fixed",
      stepHint: "Här lägger du in det som måste betalas.",
    };
  }
  return { focusAdd: null, stepHint: null };
}

type PlanRouteProps = {
  focusAdd?: null | "income" | "fixed";
  stepHint?: string | null;
};

function PlanRouteBody({
  focusAdd = null,
  stepHint = null,
}: PlanRouteProps) {
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
    // Quiet menu warm owns background refresh when cache is warm.
    if (lastPlanSnapshot()) return;
    // Keep-alive mounts Plan with Hem — wait so login→Hem owns the wire.
    const stop = afterHemBoot(() => {
      if (cancelled || lastPlanSnapshot()) return;
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
    });
    return () => {
      cancelled = true;
      stop();
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

function PlanRouteWithSteg(props: PlanRouteProps) {
  const searchParams = useSearchParams();
  const fromQuery = planFocusFromSteg(searchParams.get("steg"));
  return (
    <PlanRouteBody
      focusAdd={props.focusAdd ?? fromQuery.focusAdd}
      stepHint={props.stepHint ?? fromQuery.stepHint}
    />
  );
}

/**
 * Client-first Plan — paint last-known immediately, quiet-fetch in background.
 * Matches NextStep Sales: menu never waits on the heavy snapshot round-trip.
 */
export function PlanRouteClient(props: PlanRouteProps = {}) {
  return (
    <Suspense fallback={<PlanRouteBody {...props} />}>
      <PlanRouteWithSteg {...props} />
    </Suspense>
  );
}
