"use client";

import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { FotaScreen } from "@/components/capture/FotaScreen";
import {
  AnalysFirstPaint,
  HemFirstPaint,
  PlanFirstPaint,
} from "@/components/layout/HemFirstPaint";
import { ViewLoading } from "@/components/layout/ViewLoading";
import { MerScreen } from "@/components/mer/MerScreen";
import { MovementsScreen } from "@/components/movements/MovementsScreen";

/**
 * First-visit dest paint. These screens read last-known snapshots and
 * show a matching page shell when empty — never a blocking spinner.
 * RSC / JWT catch up after this tree is already visible.
 */
export function destLoadingForTab(tab: string | null) {
  switch (tab) {
    case "/idag":
      return <HemFirstPaint />;
    case "/plan":
      return <PlanFirstPaint />;
    case "/analys":
      return <AnalysFirstPaint />;
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
