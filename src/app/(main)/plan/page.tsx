import { PlanEditor } from "@/components/plan/PlanEditor";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { loadErrorMessageSv } from "@/lib/async";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  let error: string | null = null;
  let snap = null;
  try {
    snap = await getCachedTodaySnapshot();
  } catch (e) {
    error = loadErrorMessageSv(e, "Kunde inte ladda planen");
  }

  const currency = snap?.currency ?? "THB";
  const timeZone = snap?.profile.timezone || "Asia/Bangkok";

  return (
    <div className="numa-page numa-page-wide space-y-6">
      <header>
        <h1 className="numa-page-title">Plan</h1>
        <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Två högar som växer. Följ månad för månad — även år framåt.
        </p>
      </header>
      {error ? (
        <div className="numa-panel-strong space-y-3 p-5">
          <p className="text-sm font-semibold">Kunde inte ladda</p>
          <p className="text-sm text-[var(--numa-muted)]">{error}</p>
          <RetryLoadButton />
        </div>
      ) : (
        <section>
          <PlanEditor
            items={snap?.planItems ?? []}
            currency={currency}
            timeZone={timeZone}
            bankBalanceMinor={snap?.calculatedBalanceMinor ?? null}
            cycleSpendingMinor={snap?.cycleSpendingMinor ?? 0}
            todaySpendingMinor={snap?.todaySpendingMinor ?? 0}
            spendingByMonthKey={snap?.monthSpendingByKey ?? {}}
          />
        </section>
      )}
    </div>
  );
}
