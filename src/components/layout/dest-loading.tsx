"use client";

import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { FotaScreen } from "@/components/capture/FotaScreen";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { lastHomeSnapshot } from "@/features/home/last-snapshot";
import { ViewLoading } from "@/components/layout/ViewLoading";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";
import { PlanScreen } from "@/components/plan/PlanScreen";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";

/**
 * First-visit dest paint. These screens read last-known snapshots and
 * show a matching page shell when empty — never a blocking spinner.
 * RSC / JWT catch up after this tree is already visible.
 */
export function destLoadingForTab(tab: string | null) {
  switch (tab) {
    case "/idag":
      return <HomeDashboard snap={lastHomeSnapshot()} error={null} />;
    case "/plan":
      return <PlanScreen />;
    case "/analys":
      return <AnalysDashboard data={null} />;
    case "/mer":
      return <MerScreen data={null} />;
    case "/transaktioner":
      return <MovementsScreen data={null} />;
    case "/konton":
      return <AccountsDashboard data={null} />;
    case "/fota":
      return <FotaScreen data={null} />;
    default:
      return <ViewLoading />;
  }
}
