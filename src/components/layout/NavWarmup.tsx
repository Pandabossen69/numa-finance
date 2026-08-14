"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav";

const WARM_HREFS = [
  ...PRIMARY_NAV.map((item) => item.href),
  "/fota",
  "/transaktioner",
] as const;

/**
 * Prefetch primary destinations as soon as the shell mounts so tab switches
 * hit the client router cache instead of waiting on a cold server round-trip.
 */
export function NavWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const warm = () => {
      if (cancelled) return;
      for (const href of WARM_HREFS) {
        try {
          router.prefetch(href);
        } catch {
          // Prefetch is best-effort.
        }
      }
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(warm, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(warm, 200);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") warm();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timeoutId != null) clearTimeout(timeoutId);
      if (idleId != null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [router]);

  return null;
}
