"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { MerScreen } from "@/components/mer/MerScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";
import { AnalysPending, HemPending } from "@/components/layout/ViewLoading";
import { holdKey } from "@/components/layout/nav";
import {
  lastAnalysSnapshot,
  lastMerSnapshot,
  lastSessionHomeSnapshot,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

const subscribeNever = () => () => {};

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
    subscribeNever,
    lastAnalysSnapshot,
    () => null,
  );
  const home = useSyncExternalStore(
    subscribeHomeSnapshot,
    readSessionHome,
    () => null,
  );
  if (analys) return <AnalysDashboard data={analys} />;
  return <AnalysPending home={home} />;
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
