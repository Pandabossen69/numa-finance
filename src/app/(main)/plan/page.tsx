"use client";

import { useEffect, useState } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";

export default function PlanPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Plan
        </h1>
        <p className="mt-2 max-w-[40ch] text-sm text-[var(--numa-muted)]">
          Reserverat och buffert styr tryggt att spendera. Allt är noll tills
          första bank-SMS och du lägger till planrader.
        </p>
      </header>

      <section className="numa-panel-strong animate-rise-delay-1 grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Reserverat
          </p>
          <div className="mt-2">
            <MoneyDisplay
              amountMinor={snap?.reservedMinor ?? 0}
              currency={currency}
              size="lg"
            />
          </div>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Buffert
          </p>
          <div className="mt-2">
            <MoneyDisplay
              amountMinor={snap?.bufferMinor ?? 0}
              currency={currency}
              size="lg"
            />
          </div>
        </div>
      </section>

      <section className="numa-panel animate-rise-delay-2 p-5">
        <h2 className="text-sm font-semibold">Aktiva mål</h2>
        {(snap?.goals.length ?? 0) === 0 ? (
          <p className="mt-4 text-sm text-[var(--numa-faint)]">Inga mål ännu</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {snap!.goals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between border-b border-[var(--numa-border)] pb-3 last:border-0"
              >
                <span className="text-sm text-[var(--numa-muted)]">{goal.name}</span>
                <MoneyDisplay
                  amountMinor={goal.amountMinor}
                  currency={goal.currency}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
