"use client";

import { useEffect, useState } from "react";

/**
 * Register the worker at the stable /sw.js URL so deploys replace the
 * existing registration (a ?v= query would leave the old worker in control).
 * Wait until after first paint so a cold visit is not competing with SW install.
 * When a new build is waiting, offer a soft reload — never wipe user data.
 */
export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let idleId = 0;
    let timeoutId = 0;
    let onLoad: (() => void) | null = null;

    function afterFirstPaint(fn: () => void) {
      const run = () => {
        if (typeof requestIdleCallback === "function") {
          idleId = requestIdleCallback(fn, { timeout: 2500 });
        } else {
          timeoutId = window.setTimeout(fn, 1);
        }
      };
      if (document.readyState === "complete") {
        run();
      } else {
        onLoad = run;
        window.addEventListener("load", run, { once: true });
      }
    }

    async function setup() {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs
            .filter((reg) => {
              const url =
                reg.active?.scriptURL ??
                reg.waiting?.scriptURL ??
                reg.installing?.scriptURL ??
                "";
              return url.includes("/sw.js?");
            })
            .map((reg) => reg.unregister()),
        );

        const hadController = Boolean(navigator.serviceWorker.controller);
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
          scope: "/",
        });
        const markReady = () => {
          if (!cancelled) setUpdateReady(true);
        };
        if (reg.waiting && hadController) {
          markReady();
        }
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && hadController) {
              markReady();
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hadController) markReady();
        });
        void reg.update();
      } catch {
        // Registration is best-effort.
      }
    }

    afterFirstPaint(() => {
      void setup();
    });
    return () => {
      cancelled = true;
      if (onLoad) window.removeEventListener("load", onLoad);
      if (idleId && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
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
      className="fixed inset-x-0 z-[80] flex items-center justify-center gap-3 px-4 bottom-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+0.4rem)] pb-[max(0.35rem,var(--numa-safe-bottom))] md:bottom-6 md:pb-0"
      aria-label="Ny version"
    >
      <div className="flex max-w-lg items-center gap-3 rounded-full border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 py-1.5 shadow-[var(--numa-toast-shadow)]">
        <p className="min-w-0 text-[12px] font-medium text-[var(--numa-ink)]">
          Ny version — uppdatera
        </p>
        <button
          type="button"
          onClick={reloadFresh}
          className="numa-press inline-flex min-h-11 shrink-0 items-center px-1 text-[12px] font-semibold text-[var(--numa-accent)]"
        >
          Uppdatera
        </button>
      </div>
    </aside>
  );
}
