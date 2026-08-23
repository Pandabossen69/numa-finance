"use client";

import { useState, useSyncExternalStore } from "react";
import {
  isProductionAppHost,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
} from "@/lib/site";

const DISMISS_KEY = "numa.homescreenHint.v1";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function subscribeHomescreenHint(onStoreChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    mq.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getHomescreenHintVisible(dismissible: boolean): boolean {
  try {
    if (isStandaloneDisplay()) return false;
    if (dismissible && localStorage.getItem(DISMISS_KEY) === "1") return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Shown to every account until NUMA is on the home screen (or dismissed).
 * Always points at the shared production URL.
 */
export function HomescreenInstallHint({
  variant = "card",
  dismissible = true,
}: {
  variant?: "card" | "compact";
  dismissible?: boolean;
}) {
  const storedVisible = useSyncExternalStore(
    subscribeHomescreenHint,
    () => getHomescreenHintVisible(dismissible),
    () => false,
  );
  const alreadyOnProduction = useSyncExternalStore(
    subscribeHomescreenHint,
    () => isProductionAppHost(window.location.hostname),
    () => false,
  );
  const [dismissedHere, setDismissedHere] = useState(false);
  const visible = storedVisible && !dismissedHere;

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissedHere(true);
  }

  if (variant === "compact") {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--numa-faint)]">
        Alla konton: lägg till NUMA från{" "}
        <a
          href={PRODUCTION_ORIGIN}
          className="font-semibold text-[var(--numa-accent)]"
        >
          {PRODUCTION_HOST}
        </a>{" "}
        (Dela → Lägg till på hemskärmen).
      </p>
    );
  }

  return (
    <aside
      className="animate-rise space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-white/70 px-4 py-4"
      aria-label="Lägg till på hemskärmen"
    >
      <div className="space-y-1">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--numa-ink)]">
          Lägg NUMA på hemskärmen
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--numa-muted)]">
          Gäller alla konton. Öppna Safari på{" "}
          <span className="font-semibold text-[var(--numa-ink)]">
            {PRODUCTION_HOST}
          </span>
          , tryck Dela → Lägg till på hemskärmen. Då får ni alltid senaste
          production — ingen Vercel-länk behövs.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {alreadyOnProduction ? null : (
          <a
            href={PRODUCTION_ORIGIN}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--numa-ink)] px-4 text-sm font-semibold text-white"
          >
            Öppna rätt länk
          </a>
        )}
        {dismissible ? (
          <button
            type="button"
            onClick={dismiss}
            className="text-sm font-medium text-[var(--numa-muted)]"
          >
            Jag har redan det
          </button>
        ) : null}
      </div>
    </aside>
  );
}
