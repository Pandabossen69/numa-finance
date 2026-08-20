"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav";

const WARM_HREFS = [
  ...PRIMARY_NAV.map((item) => item.href),
  "/fota",
  "/transaktioner",
  "/lagg-till",
] as const;

/**
 * Prefetch primary destinations as soon as the shell mounts so tab switches
 * hit the client router cache instead of waiting on a cold server round-trip.
 */
export function NavWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

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

    warm();

    const onVisible = () => {
      if (document.visibilityState === "visible") warm();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
