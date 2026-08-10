"use client";

import { useEffect } from "react";

/**
 * One-shot silent cleanup of leftover service workers/caches.
 * Never auto-reloads — that caused blank flashes and "segt" loops on iPhone.
 * Manual repair lives on /installningar → Laga appen.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        const flag = "numa.swSilentDetox.v1";
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(flag)) {
          return;
        }

        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((reg) => reg.unregister()));
          }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        }

        if (!cancelled && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(flag, "1");
        }
      } catch {
        // best-effort
      }
    }

    void detox();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
