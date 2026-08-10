"use client";

import { useEffect } from "react";

const KILL_FLAG = "numa.swKill.v8";

/**
 * Unregister service workers only. Never re-register.
 * Reload at most once when an active controller was present.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        if (localStorage.getItem(KILL_FLAG) === "done") {
          // Still clear any lingering registrations without reload.
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (regs.length > 0) {
              await Promise.all(regs.map((reg) => reg.unregister()));
            }
          }
          return;
        }

        const hadController =
          "serviceWorker" in navigator &&
          Boolean(navigator.serviceWorker.controller);

        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        if (cancelled) return;

        localStorage.setItem(KILL_FLAG, "done");

        if (hadController) {
          const url = new URL(window.location.href);
          url.searchParams.set("recovered", String(Date.now()));
          window.location.replace(`${url.pathname}${url.search}`);
        }
      } catch {
        try {
          localStorage.setItem(KILL_FLAG, "done");
        } catch {
          // ignore
        }
      }
    }

    void detox();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
