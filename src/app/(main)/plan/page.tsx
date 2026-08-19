import { Suspense } from "react";
import { PlanEditor } from "@/components/plan/PlanEditor";
import { TabSoftFallback } from "@/components/layout/TabSoftFallback";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";

export const dynamic = "force-dynamic";

export default function PlanPage() {
  return (
    <div className="numa-page numa-page-wide space-y-6">
      <header className="animate-rise">
        <h1 className="numa-page-title">Plan</h1>
      </header>
      <Suspense fallback={<TabSoftFallback />}>
        <PlanContent />
      </Suspense>
    </div>
  );
}

async function PlanContent() {
  let error: string | null = null;
  let snap = null;
  try {
    snap = await getCachedTodaySnapshot();
  } catch (e) {
    error = e instanceof Error ? e.message : "Kunde inte ladda planen";
  }

  const currency = snap?.currency ?? "THB";
  const timeZone = snap?.profile.timezone || "Asia/Bangkok";

  if (error) {
    return <p className="text-sm text-[var(--numa-danger)]">{error}</p>;
  }

  return (
    <section className="animate-rise-delay-1">
      <PlanEditor
        items={snap?.planItems ?? []}
        currency={currency}
        timeZone={timeZone}
        bankBalanceMinor={snap?.calculatedBalanceMinor ?? null}
        cycleSpendingMinor={snap?.cycleSpendingMinor ?? 0}
        todaySpendingMinor={snap?.todaySpendingMinor ?? 0}
      />
    </section>
  );
}
