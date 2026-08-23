"use client";

import { useEffect, useState } from "react";

const BUILD_ID =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_NUMA_BUILD_ID ??
  "dev";

/**
 * Register the inert worker (skipWaiting + cache wipe, no HTML cache).
 * When a new build is waiting, offer a soft reload — never wipe user data.
 */
export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register(
          `/sw.js?v=${encodeURIComponent(BUILD_ID)}`,
          { updateViaCache: "none" },
        );
        const markReady = () => {
          if (!cancelled) setUpdateReady(true);
        };
        if (reg.waiting && navigator.serviceWorker.controller) {
          markReady();
        }
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              markReady();
            }
          });
        });
        void reg.update();
      } catch {
        // Registration is best-effort.
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateReady) return null;

  function reloadFresh() {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    window.location.reload();
  }

  return (
    <aside
      className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-3 px-4 pt-[max(0.6rem,var(--numa-safe-top))]"
      aria-label="Ny version"
    >
      <div className="flex max-w-lg items-center gap-3 rounded-full border border-[var(--numa-border)] bg-white/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(7,21,17,0.1)]">
        <p className="min-w-0 text-[12px] font-medium text-[var(--numa-ink)]">
          Ny version — uppdatera
        </p>
        <button
          type="button"
          onClick={reloadFresh}
          className="numa-press shrink-0 text-[12px] font-semibold text-[var(--numa-accent)]"
        >
          Uppdatera
        </button>
      </div>
    </aside>
  );
}
