import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function AnalysPage() {
  const snap = await getTodaySnapshot();

  if (!snap.primaryAccount) {
    return (
      <div className="space-y-5 pt-2">
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Analys</h1>
        <p className="max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Här ser du hur dagen och månaden rör sig när saldot är på plats.
        </p>
        <Link href="/idag" className="text-sm font-medium text-[var(--numa-accent)]">
          Ange mitt saldo →
        </Link>
      </div>
    );
  }

  const room = snap.safeToSpendTodayMinor - snap.todaySpendingMinor;
  const insight =
    room < 0
      ? "Du har använt mer än dagens trygga nivå. Imorgon är en ny chans."
      : room === 0
        ? "Du ligger exakt på dagens nivå — fint balanserat."
        : "Det finns fortfarande utrymme idag utan att pressa planen.";

  return (
    <div className="space-y-6 pt-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Analys</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          En tydlig överblick över hur pengarna rör sig just nu.
        </p>
      </header>

      <section className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4">
        <p className="text-sm font-medium">Just nu</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{insight}</p>
      </section>

      <section className="space-y-4 border-t border-[var(--numa-border)] pt-5">
        <h2 className="text-sm font-medium text-[var(--numa-muted)]">Siffror</h2>
        <div className="space-y-3">
          <Row label="Använt den här månaden">
            <MoneyDisplay
              amountMinor={snap.monthSpendingMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <Row label="Använt idag">
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
          <Row label="Kvar av dagens plan">
            <MoneyDisplay
              amountMinor={room}
              currency={snap.currency}
              size="md"
            />
          </Row>
        </div>
      </section>

      {snap.progress ? (
        <section className="space-y-2 border-t border-[var(--numa-border)] pt-5">
          <h2 className="font-medium">Din disciplin</h2>
          <p className="text-sm text-[var(--numa-muted)]">
            Streak {snap.progress.currentStreak} · {snap.progress.onTrackDays}{" "}
            dagar i fas · nivå {snap.progress.level}
          </p>
        </section>
      ) : null}
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
