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
 * Keep primary tabs mounted across revisits so Hem/Plan/Analys/Mer swap
 * instantly. Cross-tab always paints the destination — never Hem-while-Plan.
 * Same-tab refresh (Spara on Plan) keeps the live view, not loading.tsx.
 * Drill-in (Mer → Saldo) is not held.
 */
export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const destHref = pending?.href ?? pathname;
  const destTab = primaryTab(destHref);
  const pathTab = primaryTab(pathname);
  const leaving = Boolean(pending && pending.fromPath === pathname);
  const inFlight = loading || leaving;
  const liveByTabRef = useRef<Record<string, ReactNode>>({});

  const [cache, setCache] = useState<Record<string, ReactNode>>({});
  const [readyAt, setReadyAt] = useState<string | null>(
    loading || leaving ? null : pathname,
  );
  const [leaveSnapPath, setLeaveSnapPath] = useState<string | null>(null);

  if (!loading && pathTab && isTabRoot(pathname)) {
    liveByTabRef.current[pathTab] = children;
  }

  if (!inFlight && isTabRoot(pathname) && pathTab && readyAt !== pathname) {
    setReadyAt(pathname);
    setCache((current) => ({ ...current, [pathTab]: children }));
  }

  const sameTabRefresh = Boolean(
    loading && !leaving && pathTab && destTab === pathTab && isTabRoot(pathname),
  );
  if (sameTabRefresh && pathTab) {
    const live = liveByTabRef.current[pathTab];
    if (live != null && cache[pathTab] !== live) {
      setCache((current) => ({ ...current, [pathTab]: live }));
    }
  }

  if (leaving && pathTab && leaveSnapPath !== pathname) {
    setLeaveSnapPath(pathname);
    setCache((current) => ({ ...current, [pathTab]: children }));
  }
  if (!leaving && leaveSnapPath !== null) {
    setLeaveSnapPath(null);
  }

  const heldTab = readyAt ? primaryTab(readyAt) : null;
  const destLive = destTab ? liveByTabRef.current[destTab] : null;
  const paint = resolveVisibleTab({
    loading,
    leaving,
    destTab,
    heldTab,
    destIsTabRoot: isTabRoot(destHref),
    hasDestCache: Boolean(destTab && (cache[destTab] || destLive)),
  });
  const visibleTab =
    paint === "dest" ? destTab : paint === "held" ? heldTab : pathTab;

  const tabs = new Set<string>(Object.keys(cache));
  if (pathTab) tabs.add(pathTab);
  if (visibleTab) tabs.add(visibleTab);

  const heldMissing =
    inFlight &&
    ((paint === "held" && visibleTab && !cache[visibleTab] && !leaving) ||
      (paint === "dest" && destTab && !cache[destTab] && destLive == null));
  const showSoftFallback =
    (inFlight && paint === "children" && children == null) || heldMissing;

  return (
    <div
      className={inFlight ? "numa-view numa-view-hold" : "numa-view"}
      aria-busy={inFlight || undefined}
    >
      {[...tabs].map((tab) => {
        const isCurrent = tab === pathTab;
        const destHasNode = Boolean(destTab && (cache[destTab] || destLive));
        const liveIncomingDest =
          paint === "dest" && tab === destTab && isCurrent && !destHasNode;
        const live =
          isCurrent && (paint === "children" || leaving || liveIncomingDest);
        const heldLive =
          sameTabRefresh && tab === pathTab
            ? liveByTabRef.current[pathTab]
            : undefined;
        const node = live ? children : (heldLive ?? cache[tab]);
        if (node == null) return null;
        const visible = paint === "children" ? isCurrent : tab === visibleTab;
        return (
          <div
            key={tab}
            hidden={!visible}
            inert={!visible ? true : undefined}
            className={visible ? undefined : "numa-view-park"}
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
