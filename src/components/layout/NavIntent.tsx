"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isNavActive, optimisticNavPath } from "@/components/layout/nav";
import { isSpaTabHref, spaTabKey } from "@/lib/nav/spa-tabs";

type Pending = { href: string; fromPath: string };

type NavIntentValue = {
  pathname: string;
  routerPathname: string;
  highlightPath: string;
  pending: Pending | null;
  intent: Pending | null;
  spaActive: boolean;
  markIntent: (href: string) => void;
  clearIntent: () => void;
  navigateSpaTab: (href: string) => boolean;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

function pathOnly(href: string): string {
  return (href.split("?")[0] ?? href).split("#")[0] ?? href;
}

/** Flip keep-alive panels in the DOM before React reconciles — same tick as the tap. */
function paintSpaPanelsNow(dest: string) {
  if (typeof document === "undefined") return;
  const destKey = spaTabKey(dest);
  if (!destKey) return;
  const panels = document.querySelectorAll<HTMLElement>("[data-numa-spa-tab]");
  for (const el of panels) {
    const tab = el.getAttribute("data-numa-spa-tab");
    const on = tab != null && spaTabKey(tab) === destKey;
    el.toggleAttribute("hidden", !on);
    if (on) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
    el.setAttribute("data-numa-spa-visible", on ? "1" : "0");
  }
  const links = document.querySelectorAll<HTMLElement>(
    "nav.numa-bottom-nav a[href], aside a[href]",
  );
  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || !isSpaTabHref(href)) continue;
    const on = spaTabKey(href) === destKey;
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    link.classList.toggle("is-active", on);
  }
}

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const routerPathname = usePathname() ?? "/idag";
  const [spaPath, setSpaPath] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [intent, setIntent] = useState<Pending | null>(null);
  const spaOwnedRef = useRef(false);

  const pathname = spaPath ?? routerPathname;

  useEffect(() => {
    if (!spaOwnedRef.current) return;
    if (spaTabKey(routerPathname) == null) {
      spaOwnedRef.current = false;
      setSpaPath(null);
    }
  }, [routerPathname]);

  useEffect(() => {
    const onPop = () => {
      const next = pathOnly(window.location.pathname);
      if (spaTabKey(next)) {
        spaOwnedRef.current = true;
        paintSpaPanelsNow(next);
        setSpaPath(next);
        setPending(null);
        setIntent(null);
      } else {
        spaOwnedRef.current = false;
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
      const destKey = spaTabKey(dest);
      if (!destKey) return false;

      // Prefer live DOM as source of truth — React state can lag behind
      // pointerdown paints during rapid taps.
      const painted = document.querySelector(
        `[data-numa-spa-tab="${destKey}"][data-numa-spa-visible="1"]`,
      );
      if (painted && pathOnly(pathname) === dest) {
        setPending(null);
        setIntent(null);
        return true;
      }

      spaOwnedRef.current = true;
      paintSpaPanelsNow(dest);
      setSpaPath(dest);
      setPending(null);
      setIntent(null);
      try {
        window.history.pushState({ numaSpa: true, href: dest }, "", dest);
      } catch {
        // ignore
      }
      return true;
    },
    [pathname],
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
