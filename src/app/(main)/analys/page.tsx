import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function AnalysPage() {
  const snap = await getTodaySnapshot();

  return (
    <div className="space-y-6 pt-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Analys</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          En enkel överblick över hur pengarna rör sig just nu.
        </p>
      </header>

      <section className="space-y-4 border-t border-[var(--numa-border)] pt-5">
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">Den här månaden</h2>
        <div className="space-y-3">
          <Row label="Spenderat">
            <MoneyDisplay
              amountMinor={snap.monthSpendingMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <Row label="Idag">
            <MoneyDisplay
              amountMinor={snap.todaySpendingMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <Row label="Tryggt idag">
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
        </div>
      </section>

      <section className="space-y-2 border-t border-[var(--numa-border)] pt-5">
        <h2 className="font-medium">Prognos</h2>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Månads- och årsprognoser, kassaflöde till nästa inkomst och
          “kan jag köpa det här?” kommer i fas 4. Beräkningarna ska alltid gå
          via samma kanoniska data.
        </p>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--numa-muted)]">{label}</span>
      {children}
    </div>
  );
}
