"use client";

import { useState, useTransition } from "react";

export function RepairAppButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
              }
              if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
            } catch {
              // continue
            }
            setDone(true);
            window.location.href = `/idag?repair=${Date.now()}`;
          });
        }}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium text-[var(--numa-ink)] disabled:opacity-60"
      >
        {pending ? "Rensar…" : "Laga appen (rensa cache)"}
      </button>
      {done ? (
        <p className="text-sm text-[var(--numa-muted)]">Laddar om…</p>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--numa-faint)]">
          Använd om skärmen är tom eller knappar inte svarar.
        </p>
      )}
    </div>
  );
}
