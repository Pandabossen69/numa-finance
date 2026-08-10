"use client";

import { useEffect, useState } from "react";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

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
    <div className="space-y-5">
      <header className="animate-rise">
        <p className="text-sm font-medium text-[var(--numa-accent)]">
          Bank-SMS · start
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Fota och bekräfta
        </h1>
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {snap && !snap.hasBankTruth
            ? "Första SMS:et sätter hur mycket du har (available balance) och sparar beloppet som drogs. Allt är noll tills dess."
            : "Läser alla SMS i bilden, sparar bara den senaste nya — saldo efter uppdateras från banken."}
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-[var(--numa-muted)]">Förbereder…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]">{error}</p>
      ) : null}

      {snap ? (
        <ReceiptCaptureFlow
          accountId={snap.primaryAccountId}
          safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
          todaySpendingMinor={snap.todaySpendingMinor}
          currency={snap.currency}
          bootstrapping={!snap.hasBankTruth}
        />
      ) : null}
    </div>
  );
}
