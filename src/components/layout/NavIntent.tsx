"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isNavActive, optimisticNavPath } from "@/components/layout/nav";
import { isSpaTabHref, spaTabKey } from "@/lib/nav/spa-tabs";

type Pending = { href: string; fromPath: string };

type NavIntentValue = {
  /** Visible path — SPA override wins over Next pathname. */
  pathname: string;
  routerPathname: string;
  highlightPath: string;
  pending: Pending | null;
  /** Survives URL match until dest children arrive (RSC path only). */
  intent: Pending | null;
  spaActive: boolean;
  markIntent: (href: string) => void;
  clearIntent: () => void;
  /**
   * Instant primary-tab switch: pushState + keep-alive, no App Router RSC.
   * Returns true when the tap was handled as SPA.
   */
  navigateSpaTab: (href: string) => boolean;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

function pathOnly(href: string): string {
  return (href.split("?")[0] ?? href).split("#")[0] ?? href;
}

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const routerPathname = usePathname() ?? "/idag";
  const [spaPath, setSpaPath] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [intent, setIntent] = useState<Pending | null>(null);
  const [, startTransition] = useTransition();

  const pathname = spaPath ?? routerPathname;

  useEffect(() => {
    if (!spaPath) return;
    if (spaTabKey(routerPathname) == null) {
      setSpaPath(null);
      return;
    }
    if (spaTabKey(routerPathname) === spaTabKey(spaPath)) {
      setSpaPath(null);
    }
  }, [routerPathname, spaPath]);

  useEffect(() => {
    const onPop = () => {
      const next = window.location.pathname;
      if (spaTabKey(next)) {
        setSpaPath(pathOnly(next));
        setPending(null);
        setIntent(null);
      } else {
        setSpaPath(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const resolvedPending =
    pending &&
    (pending.href === pathname ||
      isNavActive(pathname, pending.href) ||
      spaTabKey(pathname) === spaTabKey(pending.href))
      ? null
      : pending;
  const highlightPath = optimisticNavPath(
    pathname,
    resolvedPending ?? intent,
  );

  const markIntent = useCallback(
    (href: string) => {
      const next = { href, fromPath: pathname };
      setPending(next);
      setIntent(next);
    },
    [pathname],
  );

  const clearIntent = useCallback(() => {
    setIntent(null);
  }, []);

  const navigateSpaTab = useCallback(
    (href: string) => {
      if (!isSpaTabHref(href)) return false;
      const dest = pathOnly(href);
      const from = pathname;
      if (spaTabKey(dest) === spaTabKey(from) && pathOnly(from) === dest) {
        setPending(null);
        setIntent(null);
        return true;
      }
      markIntent(dest);
      setSpaPath(dest);
      startTransition(() => {
        try {
          window.history.pushState({ numaSpa: true, href: dest }, "", dest);
        } catch {
          // pushState can fail in odd webviews — SPA paint still applies.
        }
      });
      queueMicrotask(() => {
        setPending(null);
        setIntent(null);
      });
      return true;
    },
    [markIntent, pathname],
  );

  const value = useMemo(
    () => ({
      pathname,
      routerPathname,
      highlightPath,
      pending: resolvedPending,
      intent,
      spaActive: spaTabKey(pathname) != null,
      markIntent,
      clearIntent,
      navigateSpaTab,
    }),
    [
      pathname,
      routerPathname,
      highlightPath,
      resolvedPending,
      intent,
      markIntent,
      clearIntent,
      navigateSpaTab,
    ],
  );

  return (
    <NavIntentContext.Provider value={value}>{children}</NavIntentContext.Provider>
  );
}

export function useNavIntent(): NavIntentValue {
  const ctx = useContext(NavIntentContext);
  if (!ctx) {
    throw new Error("useNavIntent must be used within NavIntentProvider");
  }
  return ctx;
}
