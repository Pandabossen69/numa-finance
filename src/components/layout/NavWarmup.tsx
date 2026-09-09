"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_NAV } from "@/components/layout/nav";
import { isSpaTabHref } from "@/lib/nav/spa-tabs";
import { scheduleIdleWarm, warmHrefs } from "@/lib/nav/prefetch-intent";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/** Non-SPA destinations only — primary tabs are keep-alive panels. */
const WARM_HREFS = [
  "/fota",
  "/lagg-till",
] as const;

/**
 * Warm non-SPA routes on idle. Primary tabs use SPA keep-alive + quiet
 * menu bundle — RSC prefetch of /plan|/analys was racing taps (3–10s).
 */
export function NavWarmup() {
  const router = useRouter();

  useEffect(() => {
    scheduleQuietMenuWarm();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cancelIdle = () => {};

    const warm = () => {
      if (cancelled) return;
      const hrefs = [
        ...PRIMARY_NAV.map((item) => item.href).filter((href) => !isSpaTabHref(href)),
        ...WARM_HREFS,
      ];
      warmHrefs(router, hrefs);
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
