import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function AnalysPage() {
  let snap;
  try {
    snap = await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] analys snapshot failed", error);
    return (
      <div className="space-y-4 pt-6">
        <h1 className="text-[1.65rem] font-semibold">Analys</h1>
        <p className="text-sm text-[var(--numa-muted)]">Kunde inte ladda analysen.</p>
        <a href="/analys" className="text-sm font-medium text-[var(--numa-accent)]">
          Försök igen
        </a>
      </div>
    );
  }

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
  const hasPlan = snap.reservedMinor > 0 || snap.bufferMinor > 0;

  const insight =
    room < 0
      ? "Du har använt mer än dagens trygga nivå. Imorgon är en ny chans — ingen skuld."
      : room === 0
        ? "Du ligger exakt på dagens nivå — fint balanserat."
        : hasPlan
          ? "Det finns fortfarande utrymme idag, även efter det du reserverat i planen."
          : "Det finns utrymme idag. Lägg in hinkar under Plan så blir siffran ännu ärligare.";

  const nextHint =
    snap.daysUntilIncome <= 3
      ? "Nästa inkomst är nära — bra läge att hålla lite mer buffert."
      : `Cirka ${snap.daysUntilIncome} dagar till nästa inkomst i beräkningen.`;

  return (
    <div className="space-y-6 pt-2 pb-4">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">Analys</h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Korta svar — vad som händer med pengarna just nu.
        </p>
      </header>

      <section className="space-y-3 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4">
        <p className="text-sm font-medium">Just nu</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{insight}</p>
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{nextHint}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/fota" className="text-sm font-medium text-[var(--numa-accent)]">
            Fota kvitto →
          </Link>
          <Link href="/plan" className="text-sm font-medium text-[var(--numa-accent)]">
            Justera plan →
          </Link>
        </div>
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
            <MoneyDisplay amountMinor={room} currency={snap.currency} size="md" />
          </Row>
          <Row label="Reserverat i plan">
            <MoneyDisplay
              amountMinor={snap.reservedMinor}
              currency={snap.currency}
              size="md"
            />
          </Row>
          <Row label="Buffert">
            <MoneyDisplay
              amountMinor={snap.bufferMinor}
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
          <p className="text-sm text-[var(--numa-faint)]">
            Det handlar om hur konsekvent du håller dig till din egen plan — inte
            hur mycket pengar du har.
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
