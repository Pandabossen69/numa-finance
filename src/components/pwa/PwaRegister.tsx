"use client";

import { useEffect } from "react";

const KILL_FLAG = "numa.swKill.v6";

/**
 * Kill poisoned service workers that cached blank HTML/RSC.
 * Must reload ONCE after unregister — otherwise the old controller keeps
 * serving empty <main> while the client BottomNav still hydrates.
 */
export function PwaRegister() {
  useEffect(() => {
    let cancelled = false;

    async function detox() {
      try {
        if (localStorage.getItem(KILL_FLAG) === "done") {
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

        if ("serviceWorker" in navigator) {
          try {
            await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          } catch {
            // unregister-only is still fine
          }
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
