"use client";

import { useState } from "react";
import {
  clearNumaRuntimeCache,
  nextLagaPhase,
  type LagaPhase,
} from "@/lib/pwa/repair";

/**
 * Repair page — cache is cleared only after an explicit confirm.
 * The three destinations stay available so we never auto-bounce into a blank Hem.
 */
export default function LagaPage() {
  const [phase, setPhase] = useState<LagaPhase>("idle");
  const [cacheBust] = useState(() => Date.now());

  async function runRepair() {
    setPhase("running");
    try {
      await clearNumaRuntimeCache();
      setPhase((current) => nextLagaPhase(current, "success"));
    } catch {
      setPhase((current) => nextLagaPhase(current, "fail"));
    }
  }

  const status =
    phase === "running"
      ? "Rensar cache…"
      : phase === "done"
        ? "Cache rensad. Välj vart du vill gå."
        : phase === "error"
          ? "Kunde inte rensa automatiskt. Prova länkarna ändå."
          : phase === "confirm"
            ? "Rensar bara cache på den här enheten. Dina konton raderas inte."
            : "Något strular? Rensa cache först när du själv trycker.";

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
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Laga appen</p>
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

      {phase === "idle" || phase === "error" ? (
        <button
          type="button"
          onClick={() => setPhase((current) => nextLagaPhase(current, "ask"))}
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
            border: 0,
            cursor: "pointer",
          }}
        >
          Laga appen nu
        </button>
      ) : null}

      {phase === "confirm" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              void runRepair();
            }}
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
              border: 0,
              cursor: "pointer",
            }}
          >
            Ja, rensa cache
          </button>
          <button
            type="button"
            onClick={() => setPhase((current) => nextLagaPhase(current, "cancel"))}
            style={{
              display: "flex",
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "transparent",
              color: "#5a6b61",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid rgba(19,32,25,0.12)",
              cursor: "pointer",
            }}
          >
            Avbryt
          </button>
        </div>
      ) : null}

      {phase === "running" ? (
        <p style={{ margin: 0, fontSize: 13, color: "#5a6b61" }}>
          Tar bara en sekund…
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <a
          href="https://numa-finance.vercel.app/idag"
          style={{
            display: "flex",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            background: phase === "done" ? "#1f6f5b" : "transparent",
            color: phase === "done" ? "#fff" : "#132019",
            border: phase === "done" ? 0 : "1px solid rgba(19,32,25,0.12)",
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
    </main>
  );
}
