import { PlanEditor } from "@/components/plan/PlanEditor";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";

export default async function PlanPage() {
  let error: string | null = null;
  let snap = null;
  try {
    snap = await getCachedTodaySnapshot();
  } catch (e) {
    error = e instanceof Error ? e.message : "Kunde inte ladda planen";
  }

  const currency = snap?.currency ?? "THB";
  const timeZone = snap?.profile.timezone || "Asia/Bangkok";

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Plan
        </h1>
        <p className="mt-2 max-w-[40ch] text-sm text-[var(--numa-muted)]">
          Planera kommande månader. Fasta utgifter följer med automatiskt — du
          kan alltid lägga till, ändra eller ta bort.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]">{error}</p>
      ) : (
        <>
          <section className="numa-panel-strong animate-rise-delay-1 grid gap-4 p-5 sm:grid-cols-3">
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
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
                Flex
              </p>
              <div className="mt-2">
                <MoneyDisplay
                  amountMinor={snap?.flexibleMinor ?? 0}
                  currency={currency}
                  size="lg"
                />
              </div>
            </div>
          </section>

          <section className="numa-panel animate-rise-delay-2 p-5">
            <PlanEditor
              items={snap?.planItems ?? []}
              currency={currency}
              daysUntilIncome={snap?.daysUntilIncome ?? 0}
              timeZone={timeZone}
            />
          </section>
        </>
      )}
    </div>
  );
}
