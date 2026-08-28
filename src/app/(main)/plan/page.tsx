import { GettingStartedCard } from "@/components/home/GettingStartedCard";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { loadPlanSnapshot } from "@/features/finance/load-plan";
import { loadGettingStartedView } from "@/features/getting-started/load";
import { PlanEditor } from "@/lib/route-islands";

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
  const [result, gettingStarted] = await Promise.all([
    loadPlanSnapshot(),
    loadGettingStartedView(),
  ]);
  const snap = result.ok ? result.data : null;
  const error = result.ok ? null : result.error;

  const currency = snap?.currency ?? "THB";
  const timeZone = snap?.timeZone ?? "Asia/Bangkok";

  return (
    <div className="numa-page numa-page-wide space-y-6">
      <header className="min-w-0">
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
            items={snap?.items ?? []}
            currency={currency}
            timeZone={timeZone}
            bankBalanceMinor={snap?.bankBalanceMinor ?? null}
            spendingByMonthKey={snap?.spendingByMonthKey ?? {}}
            ledgerTransactions={snap?.ledgerTransactions ?? []}
            focusAdd={focusAdd}
            stepHint={hint}
          />
        </section>
      )}
    </div>
  );
}
