import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { IdagQuickActions } from "@/components/idag/IdagQuickActions";
import { calculateDayPulse, rankForOnTrackDays } from "@/domain/gamification";
import { hoursSince } from "@/domain/finance";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";
import Link from "next/link";

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
      <div className="space-y-6 pt-4 pb-4">
        <BrandHeader />
        <section className="space-y-3">
          <p className="text-sm font-medium text-[var(--numa-accent)]">
            Steg 1 · Kom igång
          </p>
          <h1 className="text-[1.7rem] font-semibold tracking-tight">
            Vad har du just nu?
          </h1>
          <p className="max-w-[36ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
            NUMA kopplas inte till någon bank. Du anger ditt saldo själv — sedan
            kan systemet räkna vad som är ledigt och om dagen ligger plus eller
            minus.
          </p>
        </section>
        <CreateAccountForm />
      </div>
    );
  }

  const pulse = calculateDayPulse({
    safeToSpendToday: money(snap.safeToSpendTodayMinor, snap.currency),
    spentToday: money(snap.todaySpendingMinor, snap.currency),
  });

  const onTrackDays = snap.progress?.onTrackDays ?? 0;
  const rank = rankForOnTrackDays(onTrackDays);
  const streak = snap.progress?.currentStreak ?? 0;

  const balanceLabel =
    snap.balanceKind === "calculated"
      ? "Beräknat från senaste saldot du angav"
      : snap.balanceKind === "verified_checkpoint_only"
        ? "Senaste angivna saldo"
        : "Saldo saknas";

  const stale =
    !snap.checkpoint || hoursSince(snap.checkpoint.verifiedAt) > 48;

  const planHint =
    snap.reservedMinor > 0 || snap.bufferMinor > 0
      ? `Efter ${formatMoney(money(snap.reservedMinor + snap.bufferMinor, snap.currency))} i plan & buffert · ${snap.daysUntilIncome} dagar kvar`
      : `Ingen plan lagd ännu · ${snap.daysUntilIncome} dagar till nästa inkomst`;

  return (
    <div className="space-y-7 pt-2">
      <BrandHeader
        rankTitle={rank.titleSv}
        streakLabel={streak > 0 ? `Streak ${streak}` : undefined}
      />

      <DayPulseHero pulse={pulse} currency={snap.currency} />

      <IdagQuickActions
        accountId={snap.primaryAccount.id}
        verificationLabel={snap.verificationLabel}
        stale={stale}
      />

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
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {planHint}{" "}
          <Link href="/plan" className="font-medium text-[var(--numa-accent)]">
            Öppna plan
          </Link>
        </p>
      </section>

      <section className="space-y-4 border-t border-[var(--numa-border)] pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Den här månaden
        </p>
        <div className="grid grid-cols-2 gap-y-5">
          <Stat label="Använt" amount={snap.monthSpendingMinor} currency={snap.currency} />
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
          <div className="space-y-2">
            <p className="text-sm text-[var(--numa-muted)]">
              Inga rörelser ännu. Börja med ett kvitto — det tar några sekunder.
            </p>
            <Link href="/fota" className="text-sm font-medium text-[var(--numa-accent)]">
              Fota kvitto →
            </Link>
          </div>
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
              {snap.verificationLabel ?? "Ej uppdaterat ännu"}
            </p>
          </div>
          <Link href="/konton" className="text-sm text-[var(--numa-accent)]">
            Mer
          </Link>
        </div>
      </section>
    </div>
  );
}

function BrandHeader({
  rankTitle,
  streakLabel,
}: {
  rankTitle?: string;
  streakLabel?: string;
}) {
  return (
    <header className="flex items-end justify-between">
      <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
      <div className="pb-1 text-right">
        {rankTitle ? (
          <p className="text-xs font-medium text-[var(--numa-accent)]">{rankTitle}</p>
        ) : null}
        <p className="text-xs text-[var(--numa-faint)]">
          {streakLabel ? `${streakLabel} · ` : ""}Idag
        </p>
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
      return "Flytt";
    case "cash_withdrawal":
      return "Kontant";
    default:
      return "Rörelse";
  }
}
