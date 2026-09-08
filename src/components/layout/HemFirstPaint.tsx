"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { MerScreen } from "@/components/mer/MerScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";
import { AnalysPending, HemPending } from "@/components/layout/ViewLoading";
import { holdKey } from "@/components/layout/nav";
import { readLastHomeCookieFromDocument } from "@/features/home/last-home-cookie";
import {
  lastAnalysSnapshot,
  lastHomeSnapshot,
  lastMerSnapshot,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

const subscribeNever = () => () => {};

function readHome() {
  return lastHomeSnapshot() ?? readLastHomeCookieFromDocument();
}

/** Last-known Hem money, or a two-line pending — never empty mint cards. */
export function HemFirstPaint() {
  const snap = useSyncExternalStore(subscribeHomeSnapshot, readHome, () => null);
  if (snap) return <HomeDashboard snap={snap} error={null} />;
  return <HemPending />;
}

export function AnalysFirstPaint() {
  const analys = useSyncExternalStore(
    subscribeNever,
    lastAnalysSnapshot,
    () => null,
  );
  const home = useSyncExternalStore(subscribeHomeSnapshot, readHome, () => null);
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
