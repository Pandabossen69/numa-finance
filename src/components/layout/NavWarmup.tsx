"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav";
import { scheduleIdleWarm, warmHrefs } from "@/lib/nav/prefetch-intent";

const WARM_HREFS = [
  ...PRIMARY_NAV.map((item) => item.href),
  "/fota",
  "/transaktioner",
  "/lagg-till",
] as const;

/**
 * Prefetch primary destinations on idle so the first tap is not competing
 * with seven route prefetches. Pointerdown still warms the dest immediately.
 * Dest cache in LastViewOutlet covers revisits.
 */
export function NavWarmup() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let cancelIdle = () => {};

    const warm = () => {
      if (cancelled) return;
      warmHrefs(router, WARM_HREFS);
    };

    cancelIdle = scheduleIdleWarm(warm);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      cancelIdle();
      cancelIdle = scheduleIdleWarm(warm);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      cancelIdle();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
