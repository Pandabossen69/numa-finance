import { PlanRouteClient } from "@/components/plan/PlanRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Plan. RSC no longer awaits the TodaySnapshot — last-known paints
 * immediately and a quiet action refreshes in the background (NextStep pattern).
 * `?steg=` is read on the client so this page never awaits searchParams.
 */
export default function PlanPage() {
  return <PlanRouteClient />;
}
