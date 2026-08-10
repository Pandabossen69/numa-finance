"use client";

import { useEffect } from "react";

const KILL_FLAG = "numa.swKill.v7";

/**
 * Always strip service workers. Re-registering even an inert SW let some
 * browsers keep a controller that served empty <main> while BottomNav hydrated.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        const already = localStorage.getItem(KILL_FLAG) === "done";
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

        // Reload once when a controller was present OR first time on v7.
        if (hadController || !already) {
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
