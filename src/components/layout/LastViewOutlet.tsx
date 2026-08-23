"use client";

import { useState, type ReactNode } from "react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { isTabRoot, primaryTab } from "@/components/layout/nav";
import { ViewLoading } from "@/components/layout/ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
} from "@/components/layout/view-hold";

/**
 * Keep primary tabs mounted across revisits and hold the previous tab
 * while the next one streams — no blank column, no skeleton flash.
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

  const [cache, setCache] = useState<Record<string, ReactNode>>({});
  const [readyAt, setReadyAt] = useState<string | null>(
    loading || leaving ? null : pathname,
  );
  const [leaveSnapPath, setLeaveSnapPath] = useState<string | null>(null);

  if (!inFlight && isTabRoot(pathname) && pathTab && readyAt !== pathname) {
    setReadyAt(pathname);
    setCache((current) => ({ ...current, [pathTab]: children }));
  }

  if (leaving && pathTab && leaveSnapPath !== pathname) {
    setLeaveSnapPath(pathname);
    setCache((current) => ({ ...current, [pathTab]: children }));
  }
  if (!leaving && leaveSnapPath !== null) {
    setLeaveSnapPath(null);
  }

  const heldTab = readyAt ? primaryTab(readyAt) : null;
  const paint = resolveVisibleTab({
    loading,
    leaving,
    destTab,
    heldTab,
    destIsTabRoot: isTabRoot(destHref),
    hasDestCache: Boolean(destTab && cache[destTab]),
  });
  const visibleTab =
    paint === "dest" ? destTab : paint === "held" ? heldTab : pathTab;

  const tabs = new Set<string>(Object.keys(cache));
  if (pathTab) tabs.add(pathTab);
  if (visibleTab) tabs.add(visibleTab);

  const heldMissing =
    inFlight &&
    ((paint === "held" && visibleTab && !cache[visibleTab] && !leaving) ||
      (paint === "dest" && destTab && !cache[destTab]));
  const showSoftFallback =
    (inFlight && paint === "children" && children == null) || heldMissing;

  return (
    <div
      className={inFlight ? "numa-view numa-view-hold" : "numa-view"}
      aria-busy={inFlight || undefined}
    >
      {[...tabs].map((tab) => {
        const isCurrent = tab === pathTab;
        const live = isCurrent && (paint === "children" || leaving);
        const node = live ? children : cache[tab];
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
      {showSoftFallback ? <ViewLoading /> : null}
    </div>
  );
}
