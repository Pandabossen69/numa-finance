import { Suspense } from "react";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { IdagQuickActions } from "@/components/idag/IdagQuickActions";
import { calculateDayPulse, rankForOnTrackDays } from "@/domain/gamification";
import { hoursSince } from "@/domain/finance";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot, type TodaySnapshot } from "@/lib/store/repository";
import Link from "next/link";

function coerceMinor(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Streams immediately — never leave <main> empty while data loads. */
export default function IdagPage() {
  return (
    <div className="space-y-5 pt-1 text-[var(--numa-ink)]">
      <p className="text-sm text-[var(--numa-muted)]">Idag</p>
      <Suspense fallback={<IdagFallback />}>
        <IdagBody />
      </Suspense>
    </div>
  );
}

function IdagFallback() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Hämtar ditt läge…</h2>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Om detta stannar mer än några sekunder: tryck Laga uppe till höger.
      </p>
      <div className="h-28 rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-14 rounded-[1.25rem] bg-[var(--numa-accent)]/80" />
        <div className="h-14 rounded-[1.25rem] border border-[var(--numa-border)]" />
      </div>
    </div>
  );
}

function LoadFailed({ detail }: { detail?: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Kunde inte ladda</h2>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Något störde hämtningen. Ladda om eller laga appen.
      </p>
      {detail ? (
        <p className="break-words text-xs text-[var(--numa-faint)]">{detail}</p>
      ) : null}
      <div className="flex flex-col gap-3">
        <a
          href="/idag"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white"
        >
          Ladda om
        </a>
        <a
          href="/installningar?laga=1"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
        >
          Laga appen
        </a>
      </div>
    </div>
  );
}

async function IdagBody() {
  let snap: TodaySnapshot;
  try {
    snap = await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] idag snapshot failed", error);
    return (
      <LoadFailed detail={error instanceof Error ? error.message : undefined} />
    );
  }

  try {
    return renderIdag(snap);
  } catch (error) {
    console.error("[numa] idag render failed", error);
    return (
      <LoadFailed detail={error instanceof Error ? error.message : undefined} />
    );
  }
}

function renderIdag(snap: TodaySnapshot) {
  if (!snap.primaryAccount) {
    return (
      <div className="space-y-6 pb-4">
        <section className="space-y-3">
          <p className="text-sm font-medium text-[var(--numa-accent)]">
            Steg 1 · Kom igång
          </p>
          <h2 className="text-[1.7rem] font-semibold tracking-tight">
            Vad har du just nu?
          </h2>
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

  const currency = snap.currency;
  const safeToday = coerceMinor(snap.safeToSpendTodayMinor);
  const spentToday = coerceMinor(snap.todaySpendingMinor);
  const reserved = coerceMinor(snap.reservedMinor);
  const buffer = coerceMinor(snap.bufferMinor);
  const calculated =
    snap.calculatedBalanceMinor == null
      ? null
      : coerceMinor(snap.calculatedBalanceMinor);

  const pulse = calculateDayPulse({
    safeToSpendToday: money(safeToday, currency),
    spentToday: money(spentToday, currency),
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
    reserved > 0 || buffer > 0
      ? `Efter ${formatMoney(money(reserved + buffer, currency))} i plan & buffert · ${snap.daysUntilIncome} dagar kvar`
      : `Ingen plan lagd ännu · ${snap.daysUntilIncome} dagar till nästa inkomst`;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div>
          {rank.titleSv ? (
            <p className="text-xs font-medium text-[var(--numa-accent)]">
              {rank.titleSv}
            </p>
          ) : null}
          <p className="text-xs text-[var(--numa-faint)]">
            {streak > 0 ? `Streak ${streak} · ` : ""}
            Dagens översikt
          </p>
        </div>
      </div>

      <DayPulseHero pulse={pulse} currency={currency} />

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
          {calculated != null ? (
            <MoneyDisplay
              amountMinor={calculated}
              currency={currency}
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
            <MoneyDisplay amountMinor={safeToday} currency={currency} size="lg" />
            <p className="mt-1 text-sm text-[var(--numa-muted)]">idag</p>
          </div>
          <div className="text-right">
            <MoneyDisplay
              amountMinor={coerceMinor(snap.safeToSpendWeekMinor)}
              currency={currency}
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
          <Stat
            label="Använt"
            amount={coerceMinor(snap.monthSpendingMinor)}
            currency={currency}
          />
          <Stat label="Idag" amount={spentToday} currency={currency} />
          <Stat label="Reserverat" amount={reserved} currency={currency} />
          <Stat
            label="Fritt"
            amount={coerceMinor(snap.freeMinor)}
            currency={currency}
          />
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
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 py-3"
              >
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
                  {formatMoney(money(coerceMinor(tx.amountMinor), tx.currency))}
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
