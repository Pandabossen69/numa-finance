"use client";

import { useEffect, useState } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

export default function AnalysPage() {
  const [snap, setSnap] = useState<HomeSnapshot | null>(null);

  useEffect(() => {
    void getHomeSnapshotAction().then((r) => {
      if (r.ok) setSnap(r.data);
    });
  }, []);

  const currency = snap?.currency ?? "THB";

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Analys</h1>
        <p className="mt-2 max-w-[40ch] text-sm text-[var(--numa-muted)]">
          Runway och frihet. Nollor tills första bank-SMS.
        </p>
      </header>

      <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-6">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Dagar till nästa inkomst
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {snap?.daysUntilIncome ?? 0}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--numa-faint)]">Fritt efter buffert</p>
            <MoneyDisplay
              amountMinor={snap?.freeMinor ?? 0}
              currency={currency}
              size="md"
            />
          </div>
          <div>
            <p className="text-xs text-[var(--numa-faint)]">Tryggt denna vecka</p>
            <MoneyDisplay
              amountMinor={snap?.safeToSpendWeekMinor ?? 0}
              currency={currency}
              size="md"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
