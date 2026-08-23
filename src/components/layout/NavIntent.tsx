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
  markIntent: (href: string) => void;
};

const NavIntentContext = createContext<NavIntentValue | null>(null);

export function NavIntentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const resolvedPending =
    pending &&
    (pending.href === pathname || isNavActive(pathname, pending.href))
      ? null
      : pending;
  const highlightPath = optimisticNavPath(pathname, resolvedPending);

  const markIntent = useCallback(
    (href: string) => {
      setPending({ href, fromPath: pathname });
    },
    [pathname],
  );

  const value = useMemo(
    () => ({
      pathname,
      highlightPath,
      pending: resolvedPending,
      markIntent,
    }),
    [pathname, highlightPath, resolvedPending, markIntent],
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
