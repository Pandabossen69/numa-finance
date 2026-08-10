import { Suspense } from "react";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { IdagQuickActions } from "@/components/idag/IdagQuickActions";
import { hoursSince, NEXT_INCOME_NAME } from "@/domain/finance";
import { calculateDayPulse } from "@/domain/gamification";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot, type TodaySnapshot } from "@/lib/store/repository";
import Link from "next/link";
import { HardReloadLink } from "@/components/ui/HardReloadLink";

function coerceMinor(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Streams immediately — never leave <main> empty while data loads. */
export default function IdagPage() {
  return (
    <div className="space-y-5 pt-1 text-[var(--numa-ink)]">
      <Suspense fallback={<IdagFallback />}>
        <IdagBody />
      </Suspense>
    </div>
  );
}

function IdagFallback() {
  return (
    <div className="space-y-4">
      <h1 className="text-[1.65rem] font-semibold tracking-tight">NUMA</h1>
      <h2 className="text-xl font-semibold tracking-tight">Hämtar din ekonomi…</h2>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Om detta stannar mer än några sekunder: öppna Mer → Laga appen.
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
      <h1 className="text-[1.65rem] font-semibold tracking-tight">NUMA</h1>
      <h2 className="text-xl font-semibold tracking-tight">Kunde inte ladda</h2>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Något störde hämtningen. Ladda om eller laga appen.
      </p>
      {detail ? (
        <p className="break-words text-xs text-[var(--numa-faint)]">{detail}</p>
      ) : null}
      <div className="flex flex-col gap-3">
        <HardReloadLink
          href="/idag"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white"
        >
          Ladda om
        </HardReloadLink>
        <a
          href="/laga"
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
        <header>
          <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">Din ekonomi · steg 1</p>
        </header>
        <section className="space-y-3">
          <h2 className="text-[1.7rem] font-semibold tracking-tight">
            Vad har du just nu?
          </h2>
          <p className="max-w-[36ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
            Ange ditt saldo. Sedan kan du sätta mål, fota kvitton och se om du har
            råd — hela tiden.
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
  const week = coerceMinor(snap.safeToSpendWeekMinor);

  const pulse = calculateDayPulse({
    safeToSpendToday: money(safeToday, currency),
    spentToday: money(spentToday, currency),
  });

  const stale =
    !snap.checkpoint || hoursSince(snap.checkpoint.verifiedAt) > 48;

  const goals = (snap.planItems ?? []).filter(
    (p) => p.isActive && p.kind === "goal" && p.name !== NEXT_INCOME_NAME,
  );

  const roomToday = safeToday - spentToday;
  const free = coerceMinor(snap.freeMinor);
  const affordLine =
    roomToday < 0
      ? "Du har använt mer än dagens trygga nivå."
      : roomToday === 0
        ? "Du ligger exakt på dagens trygga nivå."
        : `Du har ungefär ${formatMoney(money(roomToday, currency))} kvar att använda tryggt idag.`;

  const savingLine =
    free > 0
      ? `${formatMoney(money(free, currency))} är ledigt efter mål och buffert.`
      : goals.length > 0 || reserved > 0 || buffer > 0
        ? "Allt ledigt är reserverat till mål och buffert just nu."
        : "Lägg till mål under Plan så syns hur mycket du sparar.";

  const recent = Array.isArray(snap.recentTransactions)
    ? snap.recentTransactions.slice(0, 6)
    : [];

  return (
    <div className="space-y-7 pb-2">
      <header>
        <h1 className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</h1>
        <p className="mt-1 text-sm text-[var(--numa-muted)]">
          Koll på budget, mål och varje köp
        </p>
      </header>

      <DayPulseHero pulse={pulse} currency={currency} />

      <section className="space-y-2 rounded-[1.35rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
          Har du råd?
        </p>
        <p className="text-[15px] leading-relaxed text-[var(--numa-ink)]">
          {affordLine}
        </p>
        <p className="text-sm text-[var(--numa-muted)]">{savingLine}</p>
        <p className="text-sm text-[var(--numa-muted)]">
          Baserat på saldo, plan och {snap.daysUntilIncome} dagar till nästa
          inkomst.
        </p>
      </section>

      <IdagQuickActions
        accountId={snap.primaryAccount.id}
        verificationLabel={snap.verificationLabel}
        stale={stale}
      />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          Saldo
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
        <p className="text-sm text-[var(--numa-muted)]">
          {snap.verificationLabel
            ? `Uppdaterat ${snap.verificationLabel.toLowerCase()}`
            : "Uppdatera saldot så siffrorna stämmer"}
        </p>
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
              Tryggt idag
            </p>
            <div className="mt-2">
              <MoneyDisplay amountMinor={safeToday} currency={currency} size="lg" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--numa-faint)]">denna vecka</p>
            <div className="mt-1">
              <MoneyDisplay
                amountMinor={week}
                currency={currency}
                size="md"
                compact
              />
            </div>
          </div>
        </div>
        {reserved > 0 || buffer > 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            {formatMoney(money(reserved + buffer, currency))} är redan
            reserverat i planen.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Dina mål
          </p>
          <Link href="/plan" className="text-sm text-[var(--numa-accent)]">
            Hantera
          </Link>
        </div>
        {goals.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
              Sätt ett sparmål eller planerat köp — då syns det här och räknas
              in i vad som är ledigt.
            </p>
            <Link href="/plan" className="text-sm font-medium text-[var(--numa-accent)]">
              Lägg till mål →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)]">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <p className="truncate text-sm font-medium">{g.name}</p>
                <span className="money shrink-0 text-sm font-semibold">
                  {formatMoney(money(coerceMinor(g.amountMinor), g.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border-t border-[var(--numa-border)] pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            Senaste köp
          </p>
          <Link href="/transaktioner" className="text-sm text-[var(--numa-accent)]">
            Alla
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--numa-muted)]">
              Inga köp ännu. Fota ett kvitto eller skärmbild när du betalar —
              beloppet läggs in efter att du bekräftat.
            </p>
            <Link href="/fota" className="text-sm font-medium text-[var(--numa-accent)]">
              Fota kvitto →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)]">
            {recent.map((tx) => (
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
                  {formatMoney(
                    money(coerceMinor(tx.amountMinor), tx.currency),
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      return "Köp";
  }
}
