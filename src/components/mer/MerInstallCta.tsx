"use client";

import { useState, useSyncExternalStore } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/display";
import {
  installGuideSteps,
  installGuideTitle,
  promptInstall,
  readInstallPlatform,
  readInstallPromptStatus,
  subscribeInstallPrompt,
  wantsProductionInstallAction,
} from "@/lib/pwa/install-prompt";
import {
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

/**
 * Mer (~390) install path. In-flow only — never a modal or visit nag.
 * BIP (any host, including preview) → Installera NUMA.
 * No event → distinct iOS / Android / desktop-Chromium cards.
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
    () => "chromium" as const,
  );
  const alreadyOnProduction = useSyncExternalStore(
    subscribeDisplay,
    readOnProduction,
    () => false,
  );
  const [busy, setBusy] = useState(false);

  const installed = installedDisplay || promptStatus === "accepted";
  const canPrompt = promptStatus === "available";

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
        data-numa-install="installed"
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

  const title = canPrompt
    ? "Installera NUMA som app"
    : installGuideTitle(platform);
  const steps = canPrompt
    ? "Öppna från hemskärmen, som en vanlig app."
    : installGuideSteps(platform);
  const showProductionPrimary =
    !canPrompt &&
    !alreadyOnProduction &&
    wantsProductionInstallAction(platform);

  return (
    <aside
      className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-4"
      aria-label={title}
      data-numa-install={canPrompt ? "bip" : platform}
    >
      <div className="space-y-1">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--numa-ink)]">
          {title}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--numa-muted)]">
          {steps}
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
      {showProductionPrimary ? (
        <a
          href={PRODUCTION_ORIGIN}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--numa-ink)] px-4 text-sm font-semibold text-[var(--numa-card)]"
        >
          Öppna {PRODUCTION_HOST} för att installera
        </a>
      ) : alreadyOnProduction || canPrompt ? null : (
        <a
          href={PRODUCTION_ORIGIN}
          className="inline-flex min-h-11 items-center justify-center px-1 text-sm font-medium text-[var(--numa-muted)]"
        >
          Öppna {PRODUCTION_HOST}
        </a>
      )}
    </aside>
  );
}
