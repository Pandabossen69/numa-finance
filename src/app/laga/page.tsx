"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  clearNumaRuntimeCache,
  isRepairDoneSearch,
  nextLagaPhase,
  reloadRepairSuccessPage,
  type LagaPhase,
} from "@/lib/pwa/repair";
import { BRAND_MARK } from "@/lib/brand-assets";
import {
  isFrozenHomescreenHost,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
} from "@/lib/site";

function readHostInfo(): { host: string; frozen: boolean } {
  const host = window.location.hostname;
  return { host, frozen: isFrozenHomescreenHost(host) };
}

function readRepairDone(): boolean {
  return isRepairDoneSearch(window.location.search);
}

/**
 * Update flow for home-screen iOS:
 * 1. Confirm → wipe Cache Storage only (no SKIP_WAITING — that races PwaRegister reload)
 * 2. Reload /laga?updated=1 (same-document hop)
 * 3. Show success + normal <a href="/idag"> so the user navigates with a tap
 */
export default function LagaPage() {
  const hostInfo = useSyncExternalStore(
    () => () => {},
    readHostInfo,
    () => null,
  );
  const alreadyDone = useSyncExternalStore(
    () => () => {},
    readRepairDone,
    () => false,
  );
  const [phase, setPhase] = useState<LagaPhase>("idle");
  // Query flag wins after the iOS-safe same-document reload.
  const viewPhase: LagaPhase = alreadyDone ? "done" : phase;

  async function runUpdate() {
    setPhase("running");
    try {
      await clearNumaRuntimeCache();
      if (isFrozenHomescreenHost(window.location.hostname)) {
        setPhase((current) => nextLagaPhase(current, "success"));
        return;
      }
      reloadRepairSuccessPage();
    } catch {
      setPhase((current) => nextLagaPhase(current, "fail"));
    }
  }

  const status =
    viewPhase === "running"
      ? "Uppdaterar…"
      : viewPhase === "done"
        ? hostInfo?.frozen
          ? "Cache rensad här — men appen öppnades från fel länk. Öppna production nedan."
          : "Klar. Appen är uppdaterad."
        : viewPhase === "error"
          ? "Kunde inte uppdatera. Prova igen."
          : viewPhase === "confirm"
            ? "Rensar gammal cache på den här enheten. Dina konton påverkas inte."
            : "Rensar gammal cache så appen laddar fräscht. Dina konton påverkas inte.";

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "28rem",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        padding: 20,
        color: "var(--numa-ink, #f6f1e9)",
        fontFamily: "var(--font-numa-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
        aria-label="NUMA"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_MARK}
          alt=""
          width={32}
          height={32}
          decoding="async"
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: "block",
            boxShadow: "0 0 0 1px rgba(246,241,233,0.08)",
          }}
        />
        <span
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          NUMA
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 650 }}>
          Uppdatera appen
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--numa-muted, #b9c5c5)",
          }}
        >
          {status}
        </p>
      </div>

      {hostInfo?.frozen ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            color: "#e8a078",
            wordBreak: "break-all",
          }}
        >
          Fel länk: <strong>{hostInfo.host}</strong>. Öppna{" "}
          <strong>{PRODUCTION_HOST}</strong> i stället.
        </p>
      ) : null}

      {viewPhase === "idle" || viewPhase === "error" ? (
        <button
          type="button"
          onClick={() => setPhase((current) => nextLagaPhase(current, "ask"))}
          style={primaryButtonStyle}
        >
          Uppdatera appen
        </button>
      ) : null}

      {viewPhase === "confirm" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              void runUpdate();
            }}
            style={primaryButtonStyle}
          >
            Uppdatera nu
          </button>
          <button
            type="button"
            onClick={() =>
              setPhase((current) => nextLagaPhase(current, "cancel"))
            }
            style={ghostButtonStyle}
          >
            Avbryt
          </button>
        </div>
      ) : null}

      {viewPhase === "running" ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--numa-muted, #b9c5c5)",
          }}
        >
          Tar bara en sekund…
        </p>
      ) : null}

      {viewPhase === "done" && !hostInfo?.frozen ? (
        <a href="/idag" style={primaryLinkStyle}>
          Öppna Hem
        </a>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 4,
        }}
      >
        {hostInfo?.frozen ? (
          <a href={`${PRODUCTION_ORIGIN}/idag`} style={primaryLinkStyle}>
            Öppna {PRODUCTION_HOST}
          </a>
        ) : viewPhase !== "done" ? (
          <a href="/idag" style={ghostLinkStyle}>
            Tillbaka till Hem
          </a>
        ) : null}
      </div>
    </main>
  );
}

const primaryButtonStyle: CSSProperties = {
  display: "flex",
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  background: "var(--numa-accent, #f0a15e)",
  color: "#1a120c",
  fontSize: 14,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  display: "flex",
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  background: "transparent",
  color: "var(--numa-muted, #b9c5c5)",
  fontSize: 14,
  fontWeight: 600,
  border: "1px solid rgba(246,241,233,0.12)",
  cursor: "pointer",
};

const primaryLinkStyle: CSSProperties = {
  display: "flex",
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  background: "var(--numa-accent, #f0a15e)",
  color: "#1a120c",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};

const ghostLinkStyle: CSSProperties = {
  display: "flex",
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  border: "1px solid rgba(246,241,233,0.12)",
  color: "var(--numa-ink, #f6f1e9)",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};
