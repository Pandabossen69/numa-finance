"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { MerScreen } from "@/components/mer/MerScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";
import { AnalysPending, HomeViewLoading } from "@/components/layout/ViewLoading";
import { holdKey } from "@/components/layout/nav";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  lastAnalysSnapshot,
  lastMerSnapshot,
  lastHomeShellSnapshot,
  seedHomeLoginShell,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";

const subscribeNever = () => () => {};

/**
 * Session-confirmed live Hem, or same-user login shell, or Hem-shaped
 * skeleton — never hydrate/cookie alone as *live* money (issue 107 + Christian-bar).
 * Cookie may paint as a provisional shell in first HTML (SSR) only.
 */
export function HemFirstPaint({
  cookieShell = null,
}: {
  cookieShell?: HomeSnapshot | null;
}) {
  // SSR getServerSnapshot = cookie so hard-refresh first HTML can show
  // last-known numbers (Christian-bar). Client getSnapshot prefers module
  // shell (persist hydrate / login enable) and falls back to cookie.
  const synced = useSyncExternalStore(
    subscribeHomeSnapshot,
    () => lastHomeShellSnapshot() ?? cookieShell,
    () => cookieShell,
  );

  useLayoutEffect(() => {
    seedHomeLoginShell(cookieShell);
  }, [cookieShell]);

  const snap = synced ?? cookieShell;
  if (snap) {
    return (
      <HomeDashboard
        snap={snap}
        error={null}
        adoptSnap={false}
      />
    );
  }
  return <HomeViewLoading />;
}

export function AnalysFirstPaint() {
  const analys = useSyncExternalStore(
    subscribeNever,
    lastAnalysSnapshot,
    () => null,
  );
  const home = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeShellSnapshot,
    () => null,
  );
  if (analys) return <AnalysDashboard data={analys} />;
  return <AnalysPending home={home} />;
}

/** Parent (main)/loading.tsx — pick dest last-known from the URL. */
export function MainFirstPaint({
  cookieShell = null,
}: {
  cookieShell?: HomeSnapshot | null;
}) {
  const pathname = usePathname() ?? "";
  const tab = holdKey(pathname);
  if (tab === "/analys") return <AnalysFirstPaint />;
  if (tab === "/plan") return <PlanScreen />;
  if (tab === "/mer") return <MerScreen data={lastMerSnapshot()} />;
  return <HemFirstPaint cookieShell={cookieShell} />;
}
