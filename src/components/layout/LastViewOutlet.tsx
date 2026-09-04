"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
 * Same-tab refresh (Spara on Plan) keeps the live view, not loading.tsx.
 * Drill-in (Mer → Saldo) is not held.
 */
/** Server snapshot false, client snapshot true — no mismatch either way. */
const subscribeNever = () => () => {};

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const destHref = pending?.href ?? pathname;
  const destTab = primaryTab(destHref);
  const pathTab = primaryTab(pathname);
  const leaving = Boolean(pending && pending.fromPath === pathname);
  const inFlight = loading || leaving;
  const [liveByTab, setLiveByTab] = useState<Record<string, ReactNode>>({});
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const [cache, setCache] = useState<Record<string, ReactNode>>({});
  const [readyAt, setReadyAt] = useState<string | null>(
    loading || leaving ? null : pathname,
  );
  const [leaveSnapPath, setLeaveSnapPath] = useState<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!loading && pathTab && isTabRoot(pathname)) {
      setLiveByTab((prev) =>
        prev[pathTab] === children ? prev : { ...prev, [pathTab]: children },
      );
    }
  }, [loading, pathTab, pathname, children]);

  if (!inFlight && isTabRoot(pathname) && pathTab && readyAt !== pathname) {
    setReadyAt(pathname);
    setCache((current) => ({ ...current, [pathTab]: children }));
  }

  const sameTabRefresh = Boolean(
    loading && !leaving && pathTab && destTab === pathTab && isTabRoot(pathname),
  );
  if (sameTabRefresh && pathTab) {
    const live = liveByTab[pathTab];
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
  const destLive =
    destTab === pathTab && !loading
      ? children
      : destTab
        ? liveByTab[destTab]
        : null;
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

  // Tabs stay mounted, so the window keeps the scroll offset of the tab you
  // came from. Switching after scrolling used to open the next tab halfway
  // down, with its title and controls above the fold.
  const shownTabRef = useRef<string | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!visibleTab || shownTabRef.current === visibleTab) return;
    const isFirstPaint = shownTabRef.current === null;
    shownTabRef.current = visibleTab;
    if (!isFirstPaint) window.scrollTo(0, 0);
  }, [visibleTab]);

  const tabs = new Set<string>(Object.keys(cache));
  if (pathTab) tabs.add(pathTab);
  if (visibleTab) tabs.add(visibleTab);

  const heldMissing =
    inFlight &&
    ((paint === "held" && visibleTab && !cache[visibleTab] && !leaving) ||
      (paint === "dest" && destTab && !cache[destTab] && destLive == null));
  const showSoftFallback =
    (inFlight && paint === "children" && children == null) || heldMissing;

  // The server streams the loading node, so inFlight is true there and false
  // on the client at hydration. React does not patch mismatched attributes up,
  // which left aria-busy="true" stuck on the main region on every screen.
  const holding = hydrated && inFlight;

  return (
    <div
      className={holding ? "numa-view numa-view-hold" : "numa-view"}
      aria-busy={holding || undefined}
    >
      {[...tabs].map((tab) => {
        const isCurrent = tab === pathTab;
        const live = isCurrent && (paint === "children" || leaving);
        const heldLive =
          sameTabRefresh && tab === pathTab ? liveByTab[pathTab] : undefined;
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
      {showSoftFallback ? <ViewLoading /> : null}
    </div>
  );
}
