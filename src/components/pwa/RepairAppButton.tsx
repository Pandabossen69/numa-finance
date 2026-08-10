"use client";

import { useEffect, useState, useTransition } from "react";

const KILL_FLAG = "numa.swKill.v7";

async function hardRepair(): Promise<void> {
  try {
    localStorage.removeItem(KILL_FLAG);
  } catch {
    // ignore
  }

  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  try {
    localStorage.setItem(KILL_FLAG, "done");
  } catch {
    // ignore
  }
}

export function RepairAppButton({ autoStart = false }: { autoStart?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function runRepair() {
    startTransition(async () => {
      try {
        await hardRepair();
      } catch {
        // continue to reload anyway
      }
      setDone(true);
      window.location.replace(`/idag?repair=${Date.now()}`);
    });
  }

  useEffect(() => {
    if (!autoStart) return;
    runRepair();
    // intentionally once on mount when autoStart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={runRepair}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Rensar cache…" : "Laga appen nu"}
      </button>
      {done ? (
        <p className="text-sm text-[var(--numa-muted)]">Laddar om…</p>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--numa-faint)]">
          Rensar gammal cache som kan göra Idag tom. Tar en sekund.
        </p>
      )}
    </div>
  );
}
