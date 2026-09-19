"use client";

import { useState, useSyncExternalStore } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/display";
import {
  installGuideSteps,
  promptInstall,
  readInstallPlatform,
  readInstallPromptStatus,
  subscribeInstallPrompt,
} from "@/lib/pwa/install-prompt";
import {
  isCanonicalAppHost,
  isProductionAppHost,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
} from "@/lib/site";

function subscribeDisplay(onStoreChange: () => void) {
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

function readCanNativeInstall(): boolean {
  try {
    return isCanonicalAppHost(window.location.hostname);
  } catch {
    return false;
  }
}

/**
 * Mer (~390) install path. In-flow only — never a modal or visit nag.
 * BIP → Installera NUMA. No event → iOS / Android Chrome steps.
 */
export function MerInstallCta() {
  const installedDisplay = useSyncExternalStore(
    subscribeDisplay,
    isStandaloneDisplay,
    () => false,
  );
  const promptStatus = useSyncExternalStore(
    subscribeInstallPrompt,
    readInstallPromptStatus,
    () => "none" as const,
  );
  const platform = useSyncExternalStore(
    subscribeDisplay,
    readInstallPlatform,
    () => "other" as const,
  );
  const alreadyOnProduction = useSyncExternalStore(
    subscribeDisplay,
    readOnProduction,
    () => false,
  );
  const canNativeInstall = useSyncExternalStore(
    subscribeDisplay,
    readCanNativeInstall,
    () => false,
  );
  const [busy, setBusy] = useState(false);

  const installed = installedDisplay || promptStatus === "accepted";
  const canPrompt = promptStatus === "available" && canNativeInstall;

  async function onInstall() {
    if (busy) return;
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  }

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
          {canPrompt
            ? "Öppna från hemskärmen, som en vanlig app."
            : installGuideSteps(platform)}
        </p>
      </div>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => void onInstall()}
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--numa-ink)] px-4 text-sm font-semibold text-[var(--numa-card)] disabled:opacity-60"
        >
          {busy ? "Öppnar…" : "Installera NUMA"}
        </button>
      ) : null}
      {alreadyOnProduction ? null : (
        <a
          href={PRODUCTION_ORIGIN}
          className={
            canPrompt
              ? "inline-flex min-h-11 items-center justify-center px-1 text-sm font-medium text-[var(--numa-muted)]"
              : "inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--numa-ink)] px-4 text-sm font-semibold text-[var(--numa-card)]"
          }
        >
          Öppna {PRODUCTION_HOST}
        </a>
      )}
    </aside>
  );
}
