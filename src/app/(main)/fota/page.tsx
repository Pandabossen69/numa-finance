"use client";

import { useEffect, useState } from "react";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

const ink = "#132019";
const muted = "#5a6b61";
const accent = "#1f6f5b";

export default function FotaPage() {
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
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: accent }}>
        Snabbt · kvitto eller skärmbild
      </p>
      <h1 style={{ margin: "4px 0 0", fontSize: "1.65rem", fontWeight: 700 }}>
        Fota och bekräfta
      </h1>
      <p
        style={{
          margin: "8px 0 20px",
          maxWidth: "36ch",
          fontSize: 15,
          lineHeight: 1.5,
          color: muted,
        }}
      >
        NUMA läser beloppet när det går — du godkänner innan det sparas.
      </p>

      {loading ? (
        <p style={{ fontSize: 14, color: muted }}>Förbereder…</p>
      ) : null}
      {error ? (
        <p style={{ fontSize: 14, color: "#a61f1f" }}>{error}</p>
      ) : null}

      {snap && !snap.primaryAccountId ? (
        <div>
          <p style={{ fontSize: 14, color: muted }}>
            Ange först hur mycket du har just nu.
          </p>
          <a
            href="/idag"
            style={{
              display: "flex",
              minHeight: 56,
              marginTop: 16,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              background: accent,
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Ange mitt saldo
          </a>
        </div>
      ) : null}

      {snap?.primaryAccountId ? (
        <ReceiptCaptureFlow
          accountId={snap.primaryAccountId}
          safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
          todaySpendingMinor={snap.todaySpendingMinor}
          currency={snap.currency}
        />
      ) : null}
    </div>
  );
}
