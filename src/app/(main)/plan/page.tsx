"use client";

import { useEffect, useState } from "react";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { PlanItem } from "@/domain/finance";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

const ink = "#132019";
const muted = "#5a6b61";
const accent = "#1f6f5b";

export default function PlanPage() {
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

  const editorItems: PlanItem[] = (snap?.goals ?? []).map((g) => ({
    id: g.id,
    userId: "local",
    name: g.name,
    kind: "goal",
    amountMinor: g.amountMinor,
    currency: g.currency,
    cadence: null,
    nextDueAt: null,
    isActive: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));

  return (
    <div style={{ color: ink, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: "1.65rem", fontWeight: 700 }}>Plan</h1>
      <p
        style={{
          margin: "8px 0 20px",
          maxWidth: "36ch",
          fontSize: 14,
          lineHeight: 1.5,
          color: muted,
        }}
      >
        Mål och hinkar som räknas in i vad som är tryggt att spendera.
      </p>

      {loading ? (
        <p style={{ fontSize: 14, color: muted }}>Hämtar plan…</p>
      ) : null}
      {error ? (
        <p style={{ fontSize: 14, color: "#a61f1f" }}>{error}</p>
      ) : null}

      {snap && !snap.primaryAccountId ? (
        <div>
          <p style={{ fontSize: 14, color: muted }}>
            Ange saldo på Hem innan du lägger in mål.
          </p>
          <a href="/idag" style={{ color: accent, fontWeight: 700 }}>
            Till Hem →
          </a>
        </div>
      ) : null}

      {snap?.primaryAccountId ? (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid rgba(19,32,25,0.12)",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14, color: muted }}>Tryggt idag</span>
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="md"
            />
          </div>
          <PlanEditor
            items={editorItems}
            currency={snap.currency}
            daysUntilIncome={snap.daysUntilIncome}
          />
        </div>
      ) : null}
    </div>
  );
}
