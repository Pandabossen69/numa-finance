"use client";

import { useEffect, useState } from "react";
import { SV } from "@/features/copy/labels-sv";
import { LOAD_TIMEOUT_MESSAGE_SV } from "@/lib/async";
import {
  analysPendingHasExpired,
  analysPendingRemainingMs,
  markAnalysPendingStarted,
  requestAnalysClientRetry,
} from "@/features/finance/analys-client-fetch";

/**
 * Calm route pending — text + thin bars, never near-empty mint cards.
 * Client so LastViewOutlet can recognize the type across tab holds.
 * No pulse (that reads as a reload). Soft fallback + dynamic islands.
 */
export function ViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-2 pt-1"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar"
    >
      <p className="text-sm font-medium text-[var(--numa-muted)]">Laddar…</p>
      <div className="numa-skel h-2.5 w-36 !rounded-full" />
      <div className="numa-skel h-2.5 w-24 !rounded-full" />
    </div>
  );
}

/** Calm pending — never the huge empty mint cards that look broken. */
export function HemPending() {
  return (
    <div
      className="numa-page numa-page-wide space-y-2 pt-1"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Hämtar läget"
    >
      <p className="text-sm font-medium text-[var(--numa-muted)]">Hämtar läget…</p>
      <div className="numa-skel h-2.5 w-36 !rounded-full" />
      <div className="numa-skel h-2.5 w-24 !rounded-full" />
    </div>
  );
}

/** Hem-shaped shell so /idag never paints an empty content column. */
export function HomeViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-6"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Hem"
    >
      <div className="space-y-2">
        <div className="numa-skel h-4 w-48" />
      </div>
      <div className="numa-skel h-[22rem] w-full" />
      <div className="numa-skel h-40 w-full" />
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <div className="numa-skel h-[5.25rem] w-full" />
        <div className="numa-skel h-[5.25rem] w-full" />
      </div>
      <div className="numa-skel h-24 w-full" />
    </div>
  );
}

/** Swedish fail-soft — no auto router.refresh (that put prod back on pending). */
export function AnalysFailSoft({
  error,
  retrying = false,
}: {
  error?: string | null;
  retrying?: boolean;
}) {
  return (
    <div className="numa-panel-strong animate-rise space-y-3 p-5">
      <p className="text-sm font-semibold">
        {retrying ? "Försöker igen…" : "Kunde inte hämta analysen"}
      </p>
      <p className="text-sm text-[var(--numa-muted)]">
        {retrying
          ? "Det tog längre tid än vanligt. Hämtar i bakgrunden."
          : (error ?? LOAD_TIMEOUT_MESSAGE_SV)}
      </p>
      <p className="text-sm leading-snug text-[var(--numa-faint)]">
        {SV.analysHint}
      </p>
      <button
        type="button"
        className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
        onClick={() => requestAnalysClientRetry()}
      >
        Försök igen
      </button>
    </div>
  );
}

/**
 * Analys pending — purpose copy only. Never reprint Hem's Kvar idag
 * (that made reload look like a hung Hem card).
 * Production can remount this from loading.tsx / dest-loading while the
 * action Flight POST is open — the clock is module-scoped so «Hämtar
 * analysen…» fail-softs within ~5s even when the route client unmounts.
 */
export function AnalysPending() {
  const [giveUp, setGiveUp] = useState(analysPendingHasExpired);

  useEffect(() => {
    if (giveUp) return;
    markAnalysPendingStarted();
    const timer = window.setTimeout(() => {
      setGiveUp(true);
    }, analysPendingRemainingMs());
    return () => window.clearTimeout(timer);
  }, [giveUp]);

  if (giveUp) return <AnalysFailSoft />;

  return (
    <div
      className="numa-page numa-page-wide space-y-3 pt-1"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Hämtar analysen"
    >
      <h1 className="numa-page-title">Analys</h1>
      <p className="max-w-[36ch] text-sm leading-snug text-[var(--numa-muted)]">
        {SV.analysHint}
      </p>
      <div
        className="numa-equal-chips"
        role="tablist"
        aria-label="Analysvy"
      >
        <span className="numa-scope-chip is-active min-h-11 rounded-full px-3 text-sm font-semibold bg-[var(--numa-ink)] text-[var(--numa-card)]">
          {SV.perioden}
        </span>
        <span className="numa-scope-chip min-h-11 rounded-full px-3 text-sm font-semibold bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]">
          {SV.manad}
        </span>
      </div>
      <p className="text-sm font-semibold text-[var(--numa-ink)]">
        {SV.vartGickPengarna}
      </p>
      <p className="text-sm font-semibold text-[var(--numa-ink)]">
        {SV.hurGarDet}
      </p>
      <p className="text-sm font-medium text-[var(--numa-muted)]">
        Hämtar analysen…
      </p>
      <div className="numa-skel h-2.5 w-36 !rounded-full" />
      <div className="numa-skel h-2.5 w-24 !rounded-full" />
    </div>
  );
}

/** Analys-shaped shell so /analys never paints an empty header/gradient. */
export function AnalysViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-6"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Analys"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="numa-skel h-8 w-28" />
        <div className="numa-skel h-8 w-8 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="numa-skel h-10 w-[5.5rem] rounded-full" />
        <div className="numa-skel h-10 w-[5.5rem] rounded-full" />
      </div>
      <div className="numa-skel h-[10.5rem] w-full" />
      <div className="space-y-2">
        <div className="numa-skel h-3 w-16" />
        <div className="numa-skel h-36 w-full" />
      </div>
      <div className="numa-skel h-36 w-full" />
    </div>
  );
}
