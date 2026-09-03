"use client";

import { useRef, useState, type ReactNode } from "react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { isTabRoot, primaryTab } from "@/components/layout/nav";
import {
  AnalysViewLoading,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
} from "@/components/layout/view-hold";

/**
 * Keep-alive tabs. Last tap paints immediately from cache.
 * Never write `children` into a tab that already has cache — Rapid
 * Analys RSC can arrive while the URL already says Hem, and that used
 * to replace the Hem pane with Analys.
 * Same-tab refresh (Spara) keeps the live tree, then replaces cache.
 * Drill-in (Mer → Saldo) shows children, not the Mer hub cache.
 */
export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const destHref = pending?.href ?? pathname;
  const destTab = primaryTab(destHref);
  const pathTab = primaryTab(pathname);
  const leaving = Boolean(destTab && pathTab && destTab !== pathTab);
  const drillIn = Boolean(pathTab && !isTabRoot(pathname));
  const settled = Boolean(
    !loading && !leaving && destTab && destTab === pathTab && isTabRoot(pathname),
  );
  const inFlight = loading || leaving;
  const liveByTabRef = useRef<Record<string, ReactNode>>({});
  const refreshingRef = useRef(false);
  const pathRef = useRef(pathname);
  const pathChanged = pathRef.current !== pathname;
  if (pathChanged) pathRef.current = pathname;

  const [cache, setCache] = useState<Record<string, ReactNode>>({});

  const sameTabRefresh = Boolean(
    loading && !leaving && pathTab && destTab === pathTab && isTabRoot(pathname),
  );
  if (sameTabRefresh) refreshingRef.current = true;

  if (settled && pathTab && !pathChanged) {
    liveByTabRef.current[pathTab] = children;
    const shouldReplace = refreshingRef.current;
    if (shouldReplace) refreshingRef.current = false;
    if (shouldReplace || cache[pathTab] == null) {
      setCache((current) =>
        !shouldReplace && current[pathTab] != null
          ? current
          : { ...current, [pathTab]: children },
      );
    }
  }

  const destLive = destTab ? liveByTabRef.current[destTab] : null;
  const destHasNode = Boolean(destTab && (cache[destTab] || destLive));
  const paint = resolveVisibleTab({
    loading,
    destTab,
    pathTab,
    destIsTabRoot: isTabRoot(destHref),
    hasDestCache: destHasNode,
  });
  const visibleTab = paint === "dest" ? destTab : pathTab;

  const tabs = new Set<string>(Object.keys(cache));
  if (pathTab) tabs.add(pathTab);
  if (visibleTab) tabs.add(visibleTab);

  const heldMissing = inFlight && paint === "dest" && destTab && !destHasNode;
  const showSoftFallback =
    (inFlight && paint === "children" && children == null) || heldMissing;

  return (
    <div
      className={inFlight ? "numa-view numa-view-hold" : "numa-view"}
      aria-busy={inFlight || undefined}
      data-numa-visible-tab={visibleTab ?? undefined}
    >
      {[...tabs].map((tab) => {
        const isCurrent = tab === pathTab;
        const cached = cache[tab];
        const feedLive =
          isCurrent &&
          (drillIn ||
            (settled && tab === destTab && cached == null));
        const heldLive =
          sameTabRefresh && tab === pathTab
            ? liveByTabRef.current[pathTab]
            : undefined;
        const node = feedLive ? children : (heldLive ?? cached);
        if (node == null) return null;
        const visible = paint === "children" ? isCurrent : tab === visibleTab;
        return (
          <div
            key={tab}
            hidden={!visible}
            inert={!visible ? true : undefined}
            aria-hidden={!visible ? true : undefined}
            className={visible ? undefined : "numa-view-park"}
            data-numa-tab={tab}
          >
            {node}
          </div>
        );
      })}
      {paint === "children" && !pathTab ? children : null}
      {showSoftFallback ? <DestShell tab={destTab ?? visibleTab} /> : null}
    </div>
  );
}

function DestShell({ tab }: { tab: string | null }) {
  if (tab === "/idag") return <HomeViewLoading />;
  if (tab === "/analys") return <AnalysViewLoading />;
  return <ViewLoading />;
}
