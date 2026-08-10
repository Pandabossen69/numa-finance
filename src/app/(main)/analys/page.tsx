"use client";

import { useEffect, useState } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

const ink = "#132019";
const muted = "#5a6b61";
const accent = "#1f6f5b";

export default function AnalysPage() {
  const [snap, setSnap] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getHomeSnapshotAction();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSnap(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ color: ink, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: "1.65rem", fontWeight: 700 }}>Analys</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: muted, maxWidth: "36ch" }}>
        Sparar du eller spenderar du mer just nu?
      </p>

      {loading ? (
        <p style={{ marginTop: 20, fontSize: 14, color: muted }}>Hämtar…</p>
      ) : null}

      {error ? (
        <p style={{ marginTop: 20, fontSize: 14, color: "#a61f1f" }}>{error}</p>
      ) : null}

      {snap && !snap.primaryAccountId ? (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 14, color: muted }}>
            Ange saldo på Hem först.
          </p>
          <a href="/idag" style={{ color: accent, fontWeight: 600 }}>
            Till Hem →
          </a>
        </div>
      ) : null}

      {snap?.primaryAccountId ? (
        <div style={{ marginTop: 24 }}>
          <Row label="Kvar av dagens nivå">
            <MoneyDisplay
              amountMinor={
                snap.safeToSpendTodayMinor - snap.todaySpendingMinor
              }
              currency={snap.currency}
              size="md"
              tone="signed"
            />
          </Row>
          <Row label="Ledigt efter mål">
            <MoneyDisplay
              amountMinor={snap.freeMinor}
              currency={snap.currency}
              size="md"
              tone="signed"
            />
          </Row>
          <Row label="Använt idag">
            <MoneyDisplay
              amountMinor={snap.todaySpendingMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <Row label="Tryggt idag">
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <a
            href="/fota"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: accent,
              fontWeight: 600,
            }}
          >
            Fota kvitto →
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid rgba(19,32,25,0.12)",
      }}
    >
      <span style={{ fontSize: 14, color: muted }}>{label}</span>
      {children}
    </div>
  );
}
