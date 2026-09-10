"use client";

import { useState, useTransition } from "react";
import {
  clearNumaRuntimeCache,
  navigateAfterRepair,
  nextLagaPhase,
  type LagaPhase,
} from "@/lib/pwa/repair";

export function RepairAppButton() {
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<LagaPhase>("idle");

  function runUpdate() {
    setPhase("running");
    startTransition(async () => {
      try {
        await clearNumaRuntimeCache();
        setPhase((current) => nextLagaPhase(current, "success"));
        // Same path as /laga — go to Hem, not back onto Uppdatera.
        navigateAfterRepair("/idag");
      } catch {
        setPhase((current) => nextLagaPhase(current, "fail"));
      }
    });
  }

  return (
    <div className="space-y-2">
      {phase === "idle" || phase === "error" ? (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--numa-accent)] text-sm font-semibold text-[var(--numa-card)] transition hover:brightness-105"
          onClick={() => setPhase((current) => nextLagaPhase(current, "ask"))}
        >
          Uppdatera appen
        </button>
      ) : null}
      {phase === "confirm" ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={runUpdate}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--numa-accent)] text-sm font-semibold text-[var(--numa-card)] transition hover:brightness-105 disabled:opacity-60"
          >
            Uppdatera nu
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-[var(--numa-muted)]"
            onClick={() =>
              setPhase((current) => nextLagaPhase(current, "cancel"))
            }
          >
            Avbryt
          </button>
        </div>
      ) : null}
      {phase === "running" || pending ? (
        <p className="text-[12px] text-[var(--numa-muted)]">Uppdaterar…</p>
      ) : phase === "error" ? (
        <p className="text-[12px] text-[var(--numa-muted)]">
          Kunde inte uppdatera. Prova igen.
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-[var(--numa-faint)]">
          Rensar gammal cache så appen laddar fräscht. Dina konton påverkas
          inte.
        </p>
      )}
    </div>
  );
}
