"use client";

import { useEffect, useState } from "react";

const KILL_FLAG = "numa.swKill.v5";

/**
 * Public repair page — works even when authenticated routes render blank
 * because a poisoned service worker cached empty RSC.
 */
export default function LagaPage() {
  const [status, setStatus] = useState("Rensar gammal cache…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
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

        if (!cancelled) {
          setStatus("Klar — laddar om Idag…");
          window.location.replace(`/idag?repair=${Date.now()}`);
        }
      } catch {
        if (!cancelled) {
          setStatus("Kunde inte rensa automatiskt. Dra ner för att ladda om.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[28rem] flex-col justify-center gap-4 px-5 text-[var(--numa-ink)]">
      <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
      <p className="text-lg font-semibold">Lagar appen</p>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{status}</p>
      <a
        href="/idag"
        className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white"
      >
        Till Idag
      </a>
    </main>
  );
}
