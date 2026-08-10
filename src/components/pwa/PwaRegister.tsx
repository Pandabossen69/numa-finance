"use client";

import { useEffect } from "react";

/**
 * Aggressively remove any old service worker that cached HTML/RSC and blanked
 * the app. Do not re-register a worker.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        let hadController = false;
        if ("serviceWorker" in navigator) {
          hadController = Boolean(navigator.serviceWorker.controller);
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        const flag = "numa.swDetox.v2";
        if (!cancelled && hadController && !sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, "1");
          window.location.replace(`/idag?recovered=${Date.now()}`);
        }
      } catch {
        // Best-effort only.
      }
    }

    void detox();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
