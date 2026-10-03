"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MerScreen } from "@/components/mer/MerScreen";
import { readMerSnapshot } from "@/lib/numa/read-client";
import {
  lastMerSnapshot,
  rememberMerSnapshot,
  subscribeMerSnapshot,
} from "@/features/home/last-snapshot";
import { serverNull } from "@/lib/react/server-snapshot";

/**
 * Client-first Mer — last-known (quiet-warm / Hem seed) paints immediately.
 * Quiet-warm owns the background profile/admin refresh when cache is warm.
 * SPA keep-alive never remounts this on tab switches.
 */
export function MerRouteClient() {
  const stored = useSyncExternalStore(
    subscribeMerSnapshot,
    lastMerSnapshot,
    serverNull,
  );

  useEffect(() => {
    let cancelled = false;
    // Quiet-warm seeds lastMerSnapshot from Hem and refreshes isAdmin.
    if (lastMerSnapshot()) return;
    void readMerSnapshot().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        rememberMerSnapshot(result.data);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <MerScreen data={stored} />;
}
