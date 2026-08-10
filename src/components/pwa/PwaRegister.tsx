"use client";

import { useEffect } from "react";

/**
 * NUMA previously shipped a service worker that cached HTML/RSC and broke
 * App Router navigations (blank main, dead + button) on iPhone.
 *
 * Until the PWA cache strategy is proven safe in production, we aggressively
 * unregister every worker and wipe Cache Storage so clients recover on load.
 * Do not re-register a worker here.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        const flag = "numa.swDetox.v1";
        if (!cancelled && !sessionStorage.getItem(flag)) {
          const hadController =
            "serviceWorker" in navigator &&
            Boolean(navigator.serviceWorker.controller);
          sessionStorage.setItem(flag, "1");
          if (hadController) {
            window.location.reload();
          }
        }
      } catch {
        // Best-effort recovery only.
      }
    }

    void detox();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
