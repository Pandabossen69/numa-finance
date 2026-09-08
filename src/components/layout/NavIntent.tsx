"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { isNavActive, optimisticNavPath } from "@/components/layout/nav";

type Pending = { href: string; fromPath: string };

type NavIntentValue = {
  pathname: string;
  highlightPath: string;
  pending: Pending | null;
  /** Survives URL match until dest children arrive. */
  intent: Pending | null;
  markIntent: (href: string) => void;
  clearIntent: () => void;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const [intent, setIntent] = useState<Pending | null>(null);
  const resolvedPending =
    pending &&
    (pending.href === pathname || isNavActive(pathname, pending.href))
      ? null
      : pending;
  const highlightPath = optimisticNavPath(pathname, resolvedPending ?? intent);

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

  const value = useMemo(
    () => ({
      pathname,
      highlightPath,
      pending: resolvedPending,
      intent,
      markIntent,
      clearIntent,
    }),
    [pathname, highlightPath, resolvedPending, intent, markIntent, clearIntent],
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
