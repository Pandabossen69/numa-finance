"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav";
import { warmHrefs } from "@/lib/nav/prefetch-intent";

const WARM_HREFS = [
  ...PRIMARY_NAV.map((item) => item.href),
  "/fota",
  "/transaktioner",
  "/lagg-till",
] as const;

/**
 * Prefetch primary destinations as soon as the shell mounts so tab switches
 * hit loading.tsx immediately. Full-payload prefetch blocked the outlet on
 * the snapshot; dest cache in LastViewOutlet covers revisits.
 */
export function NavWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      warmHrefs(router, WARM_HREFS);
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
