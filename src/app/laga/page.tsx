"use client";

import { useEffect, useState } from "react";

const KILL_FLAG = "numa.swKill.v8";

/**
 * Repair page — clears SW/cache, then STAYS here so we never auto-bounce
 * into a blank /idag. User chooses the next screen.
 */
export default function LagaPage() {
  const [status, setStatus] = useState("Rensar gammal cache…");
  const [ready, setReady] = useState(false);
  const [cacheBust] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        try {
          localStorage.removeItem(KILL_FLAG);
          sessionStorage.removeItem("numa.blankGuard.v1");
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
          setStatus("Cache rensad. Välj vart du vill gå.");
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setStatus("Kunde inte rensa automatiskt. Prova länkarna ändå.");
          setReady(true);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "28rem",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 16,
        padding: 20,
        color: "#132019",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.65rem", fontWeight: 600 }}>NUMA</h1>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Lagar appen</p>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#5a6b61" }}>
        {status}
      </p>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#5a6b61" }}>
        Tip: lägg till NUMA på hemskärmen från{" "}
        <a
          href="https://numa-finance.vercel.app/idag"
          style={{ color: "#1f6f5b", fontWeight: 600 }}
        >
          numa-finance.vercel.app
        </a>{" "}
        — inte från tillfälliga Vercel-länkar. Då får du alltid senaste
        production automatiskt.
      </p>
      {ready ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="https://numa-finance.vercel.app/idag"
            style={{
              display: "flex",
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "#1f6f5b",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Öppna production (rätt länk)
          </a>
          <a
            href={`/mer?r=${cacheBust}`}
            style={{
              display: "flex",
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              border: "1px solid rgba(19,32,25,0.12)",
              color: "#132019",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Öppna Mer-menyn här
          </a>
          <a
            href={`/idag?r=${cacheBust}`}
            style={{
              display: "flex",
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              border: "1px solid rgba(19,32,25,0.12)",
              color: "#132019",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Öppna Hem här
          </a>
        </div>
      ) : null}
    </main>
  );
}
