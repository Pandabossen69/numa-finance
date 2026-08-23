"use client";

import { useState, useTransition } from "react";
import { clearNumaRuntimeCache, nextLagaPhase, type LagaPhase } from "@/lib/pwa/repair";

export function RepairAppButton() {
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<LagaPhase>("idle");

  function runRepair() {
    setPhase("running");
    startTransition(async () => {
      try {
        await clearNumaRuntimeCache();
        setPhase((current) => nextLagaPhase(current, "success"));
        window.location.replace(`/idag?repair=${Date.now()}`);
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
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--numa-accent)] text-sm font-semibold text-white transition hover:bg-[var(--numa-accent-ink)]"
          onClick={() => setPhase((current) => nextLagaPhase(current, "ask"))}
        >
          Laga appen nu
        </button>
      ) : null}
      {phase === "confirm" ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={runRepair}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--numa-accent)] text-sm font-semibold text-white transition hover:bg-[var(--numa-accent-ink)] disabled:opacity-60"
          >
            Ja, rensa cache
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-[var(--numa-muted)]"
            onClick={() => setPhase((current) => nextLagaPhase(current, "cancel"))}
          >
            Avbryt
          </button>
        </div>
      ) : null}
      {phase === "running" || pending ? (
        <p className="text-[12px] text-[var(--numa-muted)]">Rensar cache…</p>
      ) : phase === "error" ? (
        <p className="text-[12px] text-[var(--numa-muted)]">
          Kunde inte rensa. Prova igen.
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-[var(--numa-faint)]">
          Rensar gammal cache som kan göra Hem tom. Tar en sekund — bara när du
          själv trycker.
        </p>
      )}
    </div>
  );
}
