"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { AnalysRouteClient } from "@/components/analys/AnalysRouteClient";
import { HemRouteClient } from "@/components/home/HemRouteClient";
import { useNavIntent } from "@/components/layout/NavIntent";
import { MerRouteClient } from "@/components/mer/MerRouteClient";
import { MovementsRouteClient } from "@/components/movements/MovementsRouteClient";
import { PlanRouteClient } from "@/components/plan/PlanRouteClient";
import { SPA_TAB_HREFS, spaTabKey, type SpaTabHref } from "@/lib/nav/spa-tabs";

/**
 * True SPA keep-alive for primary tabs (NextStep Sales pattern).
 *
 * All five panels mount with the shell and stay mounted. Taps only flip the
 * `hidden` attribute (see paintSpaPanelsNow). Lazy first-mount was a multi-
 * second stall: the DOM paint helper could not reveal a panel React had not
 * created yet. Do NOT use `.numa-view-park` (`display: none`) here — that
 * class survived the DOM paint and kept the dest invisible until React
 * caught up (often seconds while server actions resolved).
 */
export function TabKeepAlive({ children }: { children: ReactNode }) {
  const { pathname } = useNavIntent();
  const active = spaTabKey(pathname);

  // Stable element trees — lazy useState so a tab switch re-render does not
  // rebuild Plan/Analys (that was a ~500ms main-thread stall after DOM paint).
  const [panelBodies] = useState<Record<SpaTabHref, ReactNode>>(() => ({
    "/idag": <HemRouteClient />,
    "/plan": <PlanRouteClient />,
    "/analys": <AnalysRouteClient />,
    "/mer": <MerRouteClient />,
    "/transaktioner": <MovementsRouteClient />,
  }));

  useLayoutEffect(() => {
    if (!active) return;
    window.scrollTo(0, 0);
  }, [active]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div className="numa-tab-keep-alive relative min-w-0">
      {SPA_TAB_HREFS.map((tab) => (
        <SpaPanel key={tab} tab={tab} active={active}>
          {panelBodies[tab]}
        </SpaPanel>
      ))}
      <div hidden inert className="numa-view-park" data-numa-rsc-shadow="">
        {children}
      </div>
    </div>
  );
}


function SpaPanel({
  tab,
  active,
  children,
}: {
  tab: SpaTabHref;
  active: SpaTabHref;
  children: ReactNode;
}) {
  const visible = active === tab;
  return (
    <div
      hidden={!visible}
      inert={!visible ? true : undefined}
      data-numa-spa-tab={tab}
      data-numa-spa-visible={visible ? "1" : "0"}
    >
      {children}
    </div>
  );
}
