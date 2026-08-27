import { PlanEditor } from "@/components/plan/PlanEditor";
import { GettingStartedCard } from "@/components/home/GettingStartedCard";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { loadGettingStartedView } from "@/features/getting-started/load";
import { loadErrorMessageSv } from "@/lib/async";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<{ steg?: string }>;
}) {
  const steg = (await searchParams)?.steg ?? "";
  const hint =
    steg === "inkomst"
      ? "Här lägger du in det som kommer in."
      : steg === "utgift"
        ? "Här lägger du in det som måste betalas."
        : null;
  const focusAdd =
    steg === "inkomst" ? "income" : steg === "utgift" ? "fixed" : null;
  let error: string | null = null;
  let snap = null;
  try {
    snap = await getCachedTodaySnapshot();
  } catch (e) {
    error = loadErrorMessageSv(e, "Kunde inte ladda planen");
  }
  const gettingStarted = await loadGettingStartedView();

  const currency = snap?.currency ?? "THB";
  const timeZone = snap?.profile.timezone || "Asia/Bangkok";

  return (
    <div className="numa-page numa-page-wide space-y-6">
      <header>
        <h1 className="numa-page-title">Plan</h1>
        <p className="mt-1 max-w-[42ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vad som kommer in och vad som måste ut.
        </p>
      </header>
      {hint ? (
        <p className="w-full rounded-[1.15rem] bg-[var(--numa-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--numa-accent-ink)]">
          {hint}
        </p>
      ) : gettingStarted?.visible ? (
        <GettingStartedCard view={gettingStarted} />
      ) : null}
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
            spendingByMonthKey={snap?.monthSpendingByKey ?? {}}
            ledgerTransactions={snap?.ledgerTransactions ?? []}
            focusAdd={focusAdd}
            stepHint={hint}
          />
        </section>
      )}
    </div>
  );
}
