"use client";

import { useSyncExternalStore } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/display";
import {
  isProductionAppHost,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
} from "@/lib/site";

function subscribeInstallDisplay(onStoreChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function readOnProduction(): boolean {
  try {
    return isProductionAppHost(window.location.hostname);
  } catch {
    return false;
  }
}

/**
 * Mer (~390) install path. Always in-flow — never a modal or visit nag.
 * Standalone → already-an-app. Browser → commercial how-to.
 */
export function MerInstallCta() {
  const installed = useSyncExternalStore(
    subscribeInstallDisplay,
    isStandaloneDisplay,
    () => false,
  );
  const alreadyOnProduction = useSyncExternalStore(
    subscribeInstallDisplay,
    readOnProduction,
    () => false,
  );

  if (installed) {
    return (
      <aside
        className="space-y-1 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-4"
        aria-label="NUMA är en app här"
      >
        <p className="text-[15px] font-semibold tracking-tight text-[var(--numa-ink)]">
          NUMA är en app här
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--numa-muted)]">
          Du öppnar den från hemskärmen. Inget mer behövs.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-4"
      aria-label="Installera NUMA som app"
    >
      <div className="space-y-1">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--numa-ink)]">
          Installera NUMA som app
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--numa-muted)]">
          Öppna från hemskärmen, som en vanlig app. Dela → Lägg till på hemskärmen.
        </p>
      </div>
      {alreadyOnProduction ? null : (
        <a
          href={PRODUCTION_ORIGIN}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--numa-ink)] px-4 text-sm font-semibold text-[var(--numa-card)]"
        >
          Öppna {PRODUCTION_HOST}
        </a>
      )}
    </aside>
  );
}
