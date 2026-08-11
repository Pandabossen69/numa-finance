import { PlanEditor } from "@/components/plan/PlanEditor";
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
        <p className="mt-2 max-w-[42ch] text-sm text-[var(--numa-muted)]">
          En månad i taget. Fasta utgifter följer med — intäkter fyller du i
          själv.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]">{error}</p>
      ) : (
        <section className="animate-rise-delay-1">
          <PlanEditor
            items={snap?.planItems ?? []}
            currency={currency}
            timeZone={timeZone}
          />
        </section>
      )}
    </div>
  );
}
