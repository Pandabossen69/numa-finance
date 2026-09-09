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

/**
 * Flip keep-alive panels in the DOM before React reconciles — same tick as
 * the tap. Must not depend on React state or `.numa-view-park` (display:none).
 */
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
    // Belt-and-suspenders: never leave display:none from an older park class.
    el.classList.remove("numa-view-park");
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

function spaHrefFromAnchor(anchor: HTMLAnchorElement): string | null {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:")) return null;
  let path = href;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    path = url.pathname;
  } catch {
    return null;
  }
  if (!isSpaTabHref(path)) return null;
  return pathOnly(path);
}

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const routerPathname = usePathname() ?? "/idag";
  const [spaPath, setSpaPath] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [intent, setIntent] = useState<Pending | null>(null);
  const spaOwnedRef = useRef(false);
  const navigateRef = useRef<(href: string) => boolean>(() => false);

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

  // Capture any in-app SPA tab link (Analys→Plan, header NUMA, Next <Link>)
  // so App Router soft-nav never starts a 3–10s force-dynamic RSC round-trip.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = spaHrefFromAnchor(anchor);
      if (!href) return;
      navigateRef.current(href);
    };
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = spaHrefFromAnchor(anchor);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      navigateRef.current(href);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
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

  navigateRef.current = navigateSpaTab;

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
