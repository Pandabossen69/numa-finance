"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { destLoadingForTab } from "@/components/layout/dest-loading";
import { destChildrenArrived, isOutletStale } from "@/components/layout/nav-await";
import { useNavIntent } from "@/components/layout/NavIntent";
import { holdKey, isHoldRoot } from "@/components/layout/nav";
import { ViewLoading } from "@/components/layout/ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
} from "@/components/layout/view-hold";

/**
 * Keep primary tabs mounted across revisits. First visit paints the dest
 * shell immediately. URL can move before dest children arrive — keep the
 * dest shell (or dest cache) until the outlet actually swaps, otherwise
 * the previous page stays visible for the whole RSC/snapshot (~3s).
 * Same-tab refresh (Spara on Plan) keeps the live view, not loading.tsx.
 * Last intent wins: a stale RSC for an older tap never becomes visible.
 * Drill-in (Mer → Saldo) is not held.
 */
/** Server snapshot false, client snapshot true — no mismatch either way. */
const subscribeNever = () => () => {};

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending, intent, clearIntent } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const destHref = pending?.href ?? intent?.href ?? pathname;
  const destTab = holdKey(destHref);
  const pathTab = holdKey(pathname);
  const leaving = Boolean(pending && pending.fromPath === pathname);
  const intentMismatch = Boolean(
    pending && destTab && pathTab && destTab !== pathTab,
  );

  const [frozenFor, setFrozenFor] = useState<string | null>(null);
  const [frozenChildren, setFrozenChildren] = useState<ReactNode>(null);
  const childrenFrozen = Boolean(
    intent && frozenFor === intent.href && children === frozenChildren,
  );
  const outletStale = isOutletStale({
    awaitHref: intent?.href ?? null,
    pathTab,
    destTab,
    childrenFrozen,
  });
  const inFlight = loading || leaving || intentMismatch || outletStale;
  const [liveByTab, setLiveByTab] = useState<Record<string, ReactNode>>({});
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const [cache, setCache] = useState<Record<string, ReactNode>>({});
  const [readyAt, setReadyAt] = useState<string | null>(
    loading || leaving || intentMismatch ? null : pathname,
  );
  const [leaveSnapPath, setLeaveSnapPath] = useState<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!intent) {
      if (frozenFor !== null) {
        setFrozenFor(null);
        setFrozenChildren(null);
      }
      return;
    }
    const stillOnFrom = holdKey(pathname) === holdKey(intent.fromPath);
    if (stillOnFrom && frozenFor !== intent.href) {
      setFrozenFor(intent.href);
      setFrozenChildren(children);
    }
  }, [intent, pathname, children, frozenFor]);

  useIsomorphicLayoutEffect(() => {
    if (
      !destChildrenArrived({
        awaitHref: intent?.href ?? null,
        pathname,
        childrenFrozen,
        hadFreeze: Boolean(intent && frozenFor === intent.href),
        loading,
      })
    ) {
      return;
    }
    clearIntent();
  }, [intent, pathname, childrenFrozen, frozenFor, loading, clearIntent]);

  useIsomorphicLayoutEffect(() => {
    if (!loading && pathTab && isHoldRoot(pathname) && !isViewLoadingNode(children)) {
      setLiveByTab((prev) =>
        prev[pathTab] === children ? prev : { ...prev, [pathTab]: children },
      );
    }
  }, [loading, pathTab, pathname, children]);

  useIsomorphicLayoutEffect(() => {
    if (!inFlight && isHoldRoot(pathname) && pathTab && readyAt !== pathname) {
      if (isViewLoadingNode(children)) return;
      setReadyAt(pathname);
      setCache((current) => ({ ...current, [pathTab]: children }));
    }
  }, [inFlight, pathname, pathTab, readyAt, children]);

  const sameTabRefresh = Boolean(
    loading &&
      !leaving &&
      !intentMismatch &&
      !outletStale &&
      pathTab &&
      destTab === pathTab &&
      isHoldRoot(pathname),
  );

  useIsomorphicLayoutEffect(() => {
    if (!sameTabRefresh || !pathTab) return;
    const live = liveByTab[pathTab];
    if (live != null && cache[pathTab] !== live) {
      setCache((current) => ({ ...current, [pathTab]: live }));
    }
  }, [sameTabRefresh, pathTab, liveByTab, cache]);

  useIsomorphicLayoutEffect(() => {
    if (leaving && pathTab && leaveSnapPath !== pathname) {
      setLeaveSnapPath(pathname);
      setCache((current) => ({ ...current, [pathTab]: children }));
      return;
    }
    if (!leaving && leaveSnapPath !== null) {
      setLeaveSnapPath(null);
    }
  }, [leaving, pathTab, pathname, leaveSnapPath, children]);

  const heldTab = readyAt ? holdKey(readyAt) : null;
  const destLive =
    destTab === pathTab && !loading && !intentMismatch && !outletStale
      ? children
      : destTab
        ? liveByTab[destTab]
        : null;
  const paint = resolveVisibleTab({
    loading,
    leaving,
    destTab,
    heldTab,
    destIsTabRoot: isHoldRoot(destHref),
    hasDestCache: Boolean(destTab && (cache[destTab] || destLive)),
    intentMismatch,
    pathTab,
    outletStale,
  });
  const visibleTab =
    paint === "dest" || paint === "dest-loading"
      ? destTab
      : paint === "held"
        ? heldTab
        : pathTab;

  // Tabs stay mounted, so the window keeps the scroll offset of the tab you
  // came from. Switching after scrolling used to open the next tab halfway
  // down, with its title and Perioden/Månad switch above the fold.
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
        const live = isCurrent && paint === "children" && !intentMismatch;
        const heldLive =
          sameTabRefresh && tab === pathTab ? liveByTab[pathTab] : undefined;
        const destFallback =
          paint === "dest-loading" && tab === destTab
            ? destLoadingForTab(destTab)
            : null;
        const node =
          live ? children : (heldLive ?? cache[tab] ?? destLiveFor(tab, destTab, destLive) ?? destFallback);
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
      {paint !== "children" &&
      destTab === pathTab &&
      !isViewLoadingNode(children) ? (
        <div hidden inert className="numa-view-park" data-numa-hidden-live="">
          {children}
        </div>
      ) : null}
      {showSoftFallback ? (
        destTab ? (
          destLoadingForTab(destTab)
        ) : (
          <ViewLoading />
        )
      ) : null}
    </div>
  );
}

function destLiveFor(
  tab: string,
  destTab: string | null,
  destLive: ReactNode,
): ReactNode {
  if (tab !== destTab) return null;
  return destLive;
}
