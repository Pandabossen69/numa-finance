"use client";

import { formatMoneyCompact, money } from "@/domain/money";
import type { HomeSnapshot } from "@/features/finance/load-home";

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

/** Calm pending — last-known money when we have it, never empty mint cards. */
export function AnalysPending({
  home = null,
}: {
  home?: HomeSnapshot | null;
}) {
  return (
    <div
      className="numa-page numa-page-wide space-y-2 pt-1"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Hämtar analysen"
    >
      {home ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--numa-muted)]">
            Kvar idag
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatMoneyCompact(money(home.remainingTodayMinor, home.currency))}
          </p>
          <p className="text-sm text-[var(--numa-muted)]">
            {formatMoneyCompact(money(home.remainingFreeMinor, home.currency))}{" "}
            kvar i perioden
          </p>
          <p className="text-sm font-medium text-[var(--numa-muted)]">
            Hämtar analysen…
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-[var(--numa-muted)]">
            Hämtar analysen…
          </p>
          <div className="numa-skel h-2.5 w-36 !rounded-full" />
          <div className="numa-skel h-2.5 w-24 !rounded-full" />
        </>
      )}
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
