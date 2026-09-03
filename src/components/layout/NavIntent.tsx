"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNavActive, isTabRoot, optimisticNavPath, primaryTab } from "@/components/layout/nav";

type Pending = { href: string; fromPath: string };

type NavIntentValue = {
  pathname: string;
  highlightPath: string;
  pending: Pending | null;
  markIntent: (href: string) => void;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [intentHref, setIntentHref] = useState<string | null>(null);
  const intentRef = useRef<string | null>(null);
  const popRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popRef.current = true;
      intentRef.current = null;
      setIntentHref(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const markIntent = useCallback(
    (href: string) => {
      intentRef.current = href;
      setIntentHref(href);
      router.push(href, { scroll: false });
    },
    [router],
  );

  // Rapid taps: a slow Analys payload can commit after the last tap was Mer.
  // Push the last intent again so the router does not settle on the stale tab.
  useLayoutEffect(() => {
    if (popRef.current) {
      popRef.current = false;
      return;
    }
    const intent = intentRef.current;
    if (!intent || !isTabRoot(intent)) return;
    if (isNavActive(pathname, intent)) return;
    const pathTab = primaryTab(pathname);
    const destTab = primaryTab(intent);
    if (!pathTab || !destTab || pathTab === destTab) return;
    router.push(intent, { scroll: false });
  }, [pathname, router]);

  const pending =
    intentHref && !isNavActive(pathname, intentHref)
      ? { href: intentHref, fromPath: pathname }
      : null;
  const highlightPath = optimisticNavPath(pathname, pending);

  const value = useMemo(
    () => ({
      pathname,
      highlightPath,
      pending,
      markIntent,
    }),
    [pathname, highlightPath, pending, markIntent],
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
