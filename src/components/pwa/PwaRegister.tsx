"use client";

import { useEffect } from "react";

const STALE_CACHE_PREFIXES = ["numa-shell-", "numa-static-"];
const CURRENT_CACHE = "numa-static-v3";

/**
 * Registers a static-only service worker and purges older caches that used to
 * store authenticated HTML (which broke mobile navigations).
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function purgeStaleCaches() {
      if (!("caches" in window)) return;
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key !== CURRENT_CACHE &&
              STALE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
          )
          .map((key) => caches.delete(key)),
      );
    }

    async function register() {
      try {
        await purgeStaleCaches();
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        await reg.update().catch(() => {});
        if (cancelled) return;

        // If an older worker controlled the page, reload once after activation
        // so navigations use the fixed fetch rules.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          onControllerChange,
        );
      } catch {
        // Ignore registration failures in unsupported environments.
      }
    }

    let reloaded = false;
    function onControllerChange() {
      if (reloaded || cancelled) return;
      reloaded = true;
      window.location.reload();
    }

    void register();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
