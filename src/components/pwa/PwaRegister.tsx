"use client";

import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/display";
import {
  isRepairQuietWindowActive,
  shouldReloadOnControllerChange,
} from "@/lib/pwa/repair";

/**
 * NextStep-inspired update loop for daily home-screen users:
 * 1. Stable /sw.js registration (no ?v=) so deploys replace the same worker.
 * 2. updateViaCache: "none" so the browser always revalidates /sw.js.
 * 3. On installed (standalone) apps: register immediately and auto-reload
 *    when a new worker takes control — restart/resume → fresh UI.
 * 4. In the browser tab: soft "Ny version" banner instead of a surprise reload.
 * HTML/RSC is never served from the SW (see /sw.js), so a cold open already
 * gets the latest shell; this client loop covers soft resumes too.
 */
export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let idleId = 0;
    let timeoutId = 0;
    let onLoad: (() => void) | null = null;
    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const standalone = isStandaloneDisplay();

    function reloadOnce() {
      if (cancelled || reloading) return;
      // /laga just finished a cache wipe + navigate — reloading here sends the
      // user back to Uppdatera appen ("samma sida igen") or a blank dead-end.
      if (
        !shouldReloadOnControllerChange({
          hadController: true,
          standalone: true,
          repairQuiet: isRepairQuietWindowActive(),
        })
      ) {
        return;
      }
      reloading = true;
      window.location.reload();
    }

    function checkUpdate() {
      void registration?.update();
    }

    function onVisible() {
      if (document.visibilityState === "visible") checkUpdate();
    }

    function onPageShow() {
      // iOS soft-resume / bfcache — the usual "I reopened the app" path.
      checkUpdate();
    }

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
        registration = reg;

        const markReady = () => {
          if (cancelled) return;
          if (standalone) {
            // Installed PWA: never depend on a banner the user may never see.
            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            return;
          }
          setUpdateReady(true);
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
          if (
            shouldReloadOnControllerChange({
              hadController,
              standalone,
              repairQuiet: isRepairQuietWindowActive(),
            })
          ) {
            reloadOnce();
            return;
          }
          if (!hadController) return;
          if (!standalone) markReady();
        });

        checkUpdate();
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", checkUpdate);
        window.addEventListener("pageshow", onPageShow);
      } catch {
        // Registration is best-effort.
      }
    }

    // NextStep registers on mount. Home-screen apps do the same so a restart
    // revalidates /sw.js before the user navigates away. Browser tabs keep the
    // idle deferral so cold visits stay snappy.
    if (standalone) {
      void setup();
    } else {
      afterFirstPaint(() => {
        void setup();
      });
    }

    return () => {
      cancelled = true;
      if (onLoad) window.removeEventListener("load", onLoad);
      if (idleId && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkUpdate);
      window.removeEventListener("pageshow", onPageShow);
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
