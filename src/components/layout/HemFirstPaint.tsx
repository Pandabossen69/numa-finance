"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { MerScreen } from "@/components/mer/MerScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";
import { AnalysPending, HemPending } from "@/components/layout/ViewLoading";
import { holdKey } from "@/components/layout/nav";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import {
  lastAnalysSnapshot,
  lastHomeSnapshot,
  lastMerSnapshot,
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  subscribeAnalysSnapshot,
  subscribeHomeSnapshot,
  subscribePlanSnapshot,
} from "@/features/home/last-snapshot";

/** Session-confirmed Hem only — never hydrate/cookie as live kvar/Över. */
function readSessionHome() {
  return lastSessionHomeSnapshot();
}

/** Session last-known Hem, or a short pending — never stale money flash. */
export function HemFirstPaint() {
  const snap = useSyncExternalStore(
    subscribeHomeSnapshot,
    readSessionHome,
    () => null,
  );
  if (snap) return <HomeDashboard snap={snap} error={null} />;
  return <HemPending />;
}

export function AnalysFirstPaint() {
  const analys = useSyncExternalStore(
    subscribeAnalysSnapshot,
    lastAnalysSnapshot,
    () => null,
  );
  const plan = useSyncExternalStore(
    subscribePlanSnapshot,
    lastPlanSnapshot,
    () => null,
  );
  const home = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    () => null,
  );
  const view =
    (analysViewCanPaint(analys) ? analys : null) ??
    (plan || home ? ensurePaintableAnalysSnapshot() : null);
  if (view && analysViewCanPaint(view)) return <AnalysDashboard data={view} />;
  return <AnalysPending />;
}

/** Parent (main)/loading.tsx — pick dest last-known from the URL. */
export function MainFirstPaint() {
  const pathname = usePathname() ?? "";
  const tab = holdKey(pathname);
  if (tab === "/analys") return <AnalysFirstPaint />;
  if (tab === "/plan") return <PlanScreen />;
  if (tab === "/mer") return <MerScreen data={lastMerSnapshot()} />;
  return <HemFirstPaint />;
}
