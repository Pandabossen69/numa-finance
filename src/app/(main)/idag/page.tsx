import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { calculateDayPulse, rankForOnTrackDays } from "@/domain/gamification";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export default async function IdagPage() {
  let snap;
  try {
    snap = await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] idag snapshot failed", error);
    return (
      <div className="space-y-4 pt-6">
        <BrandHeader />
        <h1 className="text-2xl font-semibold tracking-tight">Kunde inte ladda idag</h1>
        <p className="text-sm text-[var(--numa-muted)]">
          Försök ladda om. Om felet kvarstår, logga ut och in igen.
        </p>
        <Link href="/logga-in" className="text-sm font-medium text-[var(--numa-accent)]">
          Till inloggning
        </Link>
      </div>
    );
  }

  if (!snap.primaryAccount) {
    return (
      <div className="flex min-h-[70dvh] flex-col pt-4">
        <BrandHeader />
        <div className="mt-8 flex flex-1 flex-col justify-center space-y-5 pb-8">
          <p className="text-[2.5rem] font-semibold leading-none tracking-[-0.05em]">
            NUMA
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--numa-accent)]">
              Steg 1 av 2 · Du är inloggad
            </p>
            <h1 className="max-w-[16ch] text-[1.7rem] font-semibold tracking-tight">
              Lägg till ditt bankkonto
            </h1>
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
              Ange verifierat saldo. Sedan kan du registrera utgifter och se live
              om dagen ligger plus eller minus.
            </p>
          </div>
          <Link
            href="/konton/ny"
            className="inline-flex min-h-14 items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] px-5 text-[15px] font-semibold text-white"
          >
            Lägg till bankkonto
          </Link>
        </div>
      </div>
    );
  }

  const pulse = calculateDayPulse({
    safeToSpendToday: money(snap.safeToSpendTodayMinor, snap.currency),
    spentToday: money(snap.todaySpendingMinor, snap.currency),
  });

  const onTrackHint = pulse.status === "minus" ? 0 : 1;
  const rank = rankForOnTrackDays(onTrackHint);

  const balanceLabel =
    snap.balanceKind === "calculated"
      ? "Beräknat från verifierat saldo"
      : snap.balanceKind === "verified_checkpoint_only"
        ? "Verifierat saldo"
        : "Saldo saknas";

  return (
    <div className="space-y-8 pt-2">
      <BrandHeader rankTitle={rank.titleSv} />

      <DayPulseHero pulse={pulse} currency={snap.currency} />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Tillgängligt
        </p>
        <div>
          {snap.calculatedBalanceMinor != null ? (
            <MoneyDisplay
              amountMinor={snap.calculatedBalanceMinor}
              currency={snap.currency}
              size="xl"
            />
          ) : (
            <span className="text-3xl font-semibold">—</span>
          )}
        </div>
        <p className="text-sm text-[var(--numa-muted)]">{balanceLabel}</p>
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Tryggt att spendera
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <MoneyDisplay
              amountMinor={snap.safeToSpendTodayMinor}
              currency={snap.currency}
              size="lg"
            />
            <p className="mt-1 text-sm text-[var(--numa-muted)]">idag</p>
          </div>
          <div className="text-right">
            <MoneyDisplay
              amountMinor={snap.safeToSpendWeekMinor}
              currency={snap.currency}
              size="md"
              compact
            />
            <p className="mt-1 text-sm text-[var(--numa-muted)]">denna vecka</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-[var(--numa-border)] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Den här månaden
        </p>
        <div className="grid grid-cols-2 gap-y-5">
          <Stat label="Spenderat" amount={snap.monthSpendingMinor} currency={snap.currency} />
          <Stat label="Idag" amount={snap.todaySpendingMinor} currency={snap.currency} />
          <Stat label="Reserverat" amount={snap.reservedMinor} currency={snap.currency} />
          <Stat label="Fritt" amount={snap.freeMinor} currency={snap.currency} />
        </div>
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Senaste
          </p>
          <Link href="/transaktioner" className="text-sm text-[var(--numa-accent)]">
            Visa alla
          </Link>
        </div>
        {snap.recentTransactions.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Tryck + och registrera första utgiften — pulsen uppdateras direkt.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)]">
            {snap.recentTransactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-[var(--numa-faint)]">
                    {tx.category ?? typeLabel(tx.transactionType)}
                  </p>
                </div>
                <span
                  className={`money shrink-0 text-sm font-semibold ${
                    tx.direction === "debit"
                      ? "text-[var(--numa-ink)]"
                      : "text-[var(--numa-positive)]"
                  }`}
                >
                  {tx.direction === "debit" ? "−" : "+"}
                  {formatMoney(money(tx.amountMinor, tx.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 border-t border-[var(--numa-border)] pt-6 pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Konto
        </p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">
              {snap.primaryAccount.name}
              {snap.primaryAccount.maskedIdentifier
                ? ` ·${snap.primaryAccount.maskedIdentifier}`
                : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--numa-muted)]">
              {snap.verificationLabel ?? "Ej verifierat ännu"}
            </p>
          </div>
          <Link href="/konton" className="text-sm text-[var(--numa-accent)]">
            Hantera
          </Link>
        </div>
      </section>
    </div>
  );
}

function BrandHeader({ rankTitle }: { rankTitle?: string }) {
  return (
    <header className="flex items-end justify-between">
      <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
      <div className="pb-1 text-right">
        {rankTitle ? (
          <p className="text-xs font-medium text-[var(--numa-accent)]">{rankTitle}</p>
        ) : null}
        <p className="text-xs text-[var(--numa-faint)]">Idag</p>
      </div>
    </header>
  );
}

function Stat({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: "THB" | "SEK";
}) {
  return (
    <div>
      <p className="text-sm text-[var(--numa-muted)]">{label}</p>
      <div className="mt-1">
        <MoneyDisplay amountMinor={amount} currency={currency} size="md" compact />
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Överföring";
    default:
      return "Transaktion";
  }
}
