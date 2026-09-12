"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MerScreen } from "@/components/mer/MerScreen";
import { getMerSnapshotAction } from "@/features/finance/mer-snapshot";
import {
  lastMerSnapshot,
  rememberMerSnapshot,
  subscribeMerSnapshot,
} from "@/features/home/last-snapshot";
import { afterHemBoot } from "@/lib/nav/after-hem-boot";

/**
 * Client-first Mer — last-known paints immediately; quiet profile fetch
 * in the background. SPA keep-alive never remounts this on tab switches.
 */
export function MerRouteClient() {
  const stored = useSyncExternalStore(
    subscribeMerSnapshot,
    lastMerSnapshot,
    lastMerSnapshot,
  );

  useEffect(() => {
    let cancelled = false;
    // Quiet menu warm owns background refresh when cache is warm.
    if (lastMerSnapshot()) return;
    const stop = afterHemBoot(() => {
      if (cancelled || lastMerSnapshot()) return;
      void getMerSnapshotAction().then((result) => {
        if (cancelled) return;
        if (result.ok) {
          rememberMerSnapshot(result.data);
        }
      });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return <MerScreen data={stored} />;
}
