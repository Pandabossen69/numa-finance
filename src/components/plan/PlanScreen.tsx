"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { GettingStartedCard } from "@/components/home/GettingStartedCard";
import { warmupPlanPageData } from "@/components/plan/plan-cache";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import {
  lastGettingStarted,
  lastHomeSnapshot,
  lastPlanSnapshot,
  rememberGettingStarted,
  rememberPlanSnapshot,
  subscribeGettingStarted,
  subscribePlanSnapshot,
  syncHomeCoverageFromPlan,
} from "@/features/home/last-snapshot";
import { PlanEditor } from "@/lib/route-islands";

export function PlanScreen({
  focusAdd = null,
  stepHint = null,
  initial = null,
  initialError = null,
  initialGettingStarted = null,
}: {
  focusAdd?: null | "income" | "fixed";
  stepHint?: string | null;
  initial?: PlanSnapshot | null;
  initialError?: string | null;
  initialGettingStarted?: GettingStartedView | null;
}) {
  const stored = useSyncExternalStore(
    subscribePlanSnapshot,
    lastPlanSnapshot,
    lastPlanSnapshot,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    lastGettingStarted,
  );
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (initial) {
      rememberPlanSnapshot(initial);
      syncHomeCoverageFromPlan(initial);
    }
    if (initialGettingStarted) rememberGettingStarted(initialGettingStarted);
  }, [initial, initialGettingStarted]);

  useEffect(() => {
    let cancelled = false;
    void warmupPlanPageData().then((result) => {
      if (cancelled) return;
      if (!result.ok && !lastPlanSnapshot() && !initial) setError(result.error);
      else setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const payload = stored ?? initial;
  const gettingStarted = storedGettingStarted ?? initialGettingStarted;
  const home = lastHomeSnapshot();
  const currency = payload?.currency ?? home?.currency ?? "THB";
  const timeZone = payload?.timeZone ?? home?.timeZone ?? "Asia/Bangkok";

  return (
    <div className="numa-page numa-page-wide space-y-6">
      <header className="min-w-0">
        <h1 className="numa-page-title">Plan</h1>
        <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vad som kommer in och vad som måste ut.
        </p>
      </header>
      {stepHint ? (
        <p className="w-full rounded-[1.15rem] bg-[var(--numa-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--numa-accent-ink)]">
          {stepHint}
        </p>
      ) : gettingStarted?.visible ? (
        <GettingStartedCard view={gettingStarted} />
      ) : null}
      {error && !payload ? (
        <div className="numa-panel-strong space-y-3 p-5">
          <p className="text-sm font-semibold">Kunde inte ladda</p>
          <p className="text-sm text-[var(--numa-muted)]">{error}</p>
          <RetryLoadButton />
        </div>
      ) : (
        <section>
          <PlanEditor
            items={payload?.items ?? []}
            currency={currency}
            timeZone={timeZone}
            bankBalanceMinor={payload?.bankBalanceMinor ?? home?.calculatedBalanceMinor ?? null}
            spendingByMonthKey={payload?.spendingByMonthKey ?? {}}
            ledgerTransactions={payload?.ledgerTransactions ?? []}
            focusAdd={focusAdd}
            stepHint={stepHint}
          />
        </section>
      )}
    </div>
  );
}
