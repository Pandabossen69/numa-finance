"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnalysRouteClient } from "@/components/analys/AnalysRouteClient";
import { HemRouteClient } from "@/components/home/HemRouteClient";
import { useNavIntent } from "@/components/layout/NavIntent";
import { MerRouteClient } from "@/components/mer/MerRouteClient";
import { MovementsRouteClient } from "@/components/movements/MovementsRouteClient";
import { PlanRouteClient } from "@/components/plan/PlanRouteClient";
import { spaTabKey, type SpaTabHref } from "@/lib/nav/spa-tabs";

/**
 * True SPA keep-alive for primary tabs (NextStep Sales pattern).
 * Panels mount once and stay mounted; taps only toggle visibility.
 * Next `children` back soft-nav for non-SPA routes and cold hydration.
 */
export function TabKeepAlive({ children }: { children: ReactNode }) {
  const { pathname } = useNavIntent();
  const active = spaTabKey(pathname);
  const [mounted, setMounted] = useState<Set<SpaTabHref>>(() => {
    const initial = new Set<SpaTabHref>();
    if (active) initial.add(active);
    return initial;
  });

  useEffect(() => {
    if (!active) return;
    setMounted((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
    // Reset window scroll when switching SPA tabs (panels stay mounted).
    window.scrollTo(0, 0);
  }, [active]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div className="numa-tab-keep-alive relative min-w-0">
      <SpaPanel tab="/idag" active={active} mounted={mounted}>
        <HemRouteClient />
      </SpaPanel>
      <SpaPanel tab="/plan" active={active} mounted={mounted}>
        <PlanRouteClient />
      </SpaPanel>
      <SpaPanel tab="/analys" active={active} mounted={mounted}>
        <AnalysRouteClient />
      </SpaPanel>
      <SpaPanel tab="/mer" active={active} mounted={mounted}>
        <MerRouteClient />
      </SpaPanel>
      <SpaPanel tab="/transaktioner" active={active} mounted={mounted}>
        <MovementsRouteClient />
      </SpaPanel>
      <div hidden inert className="numa-view-park" data-numa-rsc-shadow="">
        {children}
      </div>
    </div>
  );
}

function SpaPanel({
  tab,
  active,
  mounted,
  children,
}: {
  tab: SpaTabHref;
  active: SpaTabHref;
  mounted: Set<SpaTabHref>;
  children: ReactNode;
}) {
  if (!mounted.has(tab)) return null;
  const visible = active === tab;
  return (
    <div
      hidden={!visible}
      inert={!visible ? true : undefined}
      className={visible ? undefined : "numa-view-park"}
      data-numa-spa-tab={tab}
      data-numa-spa-visible={visible ? "1" : "0"}
    >
      {children}
    </div>
  );
}
