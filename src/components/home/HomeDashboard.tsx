"use client";

import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { homeGreeting } from "@/features/home/mock-snapshot";
import Link from "next/link";

export function HomeDashboard({
  snap,
  error,
}: {
  snap: HomeSnapshot | null;
  error?: string | null;
}) {
  if (error || !snap) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <Link href="/fota" className="text-sm font-semibold text-[var(--numa-accent)]">
          Gå till Fota →
        </Link>
      </div>
    );
  }

  const currency = snap.currency;
  const bootstrapped = snap.hasBankTruth;
  const greeting = homeGreeting();
  const freeOk = snap.freeToSpendMinor >= 0;
  const dayOk = snap.perDayBudgetMinor > 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="animate-rise">
        <p className="text-sm font-medium capitalize text-[var(--numa-muted)]">
          {greeting} · {snap.monthLabelSv}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)] md:text-4xl">
          Hem
        </h1>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Speglar Plan för {snap.monthLabelSv} — intäkter, utgifter, sparande
          och vad du får röra dig med per dag.
        </p>
      </header>

      {/* Hero: daily budget */}
      <section
        className="numa-panel-strong animate-rise-delay-1 relative overflow-hidden p-6 md:p-8"
        aria-labelledby="day-budget-heading"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--numa-accent-soft)] opacity-70 blur-2xl"
        />
        <p
          id="day-budget-heading"
          className="relative text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-faint)]"
        >
          Budget per dag
        </p>
        <div
          className={`relative mt-3 ${dayOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"}`}
        >
          <MoneyDisplay
            amountMinor={snap.perDayBudgetMinor}
            currency={currency}
            size="xl"
          />
        </div>
        <p className="relative mt-3 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {dayOk
            ? `Det här får du röra dig med varje dag · ${snap.spendDaysLeft} dagar kvar i månaden.`
            : freeOk
              ? "Lägg in intäkter i Plan för att få en dagbudget."
              : "Planen täcker mer än intäkterna just nu — justera Plan."}
        </p>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          <MiniFact
            label="Fritt denna månad"
            amountMinor={snap.freeToSpendMinor}
            currency={currency}
            hint="Efter utgifter och sparande"
            tone={freeOk ? "positive" : "danger"}
          />
          <MiniFact
            label="Sparas undan"
            amountMinor={snap.planSavingsMinor}
            currency={currency}
            hint={
              snap.planSavingsMinor > 0
                ? "Samma belopp som i Plan"
                : "Inget sparmål satt i Plan"
            }
          />
        </div>
      </section>

      {/* Month strip synced with Plan */}
      <section className="animate-rise-delay-2 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Månaden · Plan
          </h2>
          <Link
            href="/plan"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Öppna Plan →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Intäkter"
            amountMinor={snap.planIncomeMinor}
            currency={currency}
            hint="Planerad inkomst"
            tone="positive"
          />
          <StatTile
            label="Utgifter"
            amountMinor={snap.planExpenseMinor}
            currency={currency}
            hint="Fasta + planerade"
          />
          <StatTile
            label="Totalt att spendera"
            amountMinor={snap.freeToSpendMinor}
            currency={currency}
            hint={
              snap.planSavingsMinor > 0
                ? `Efter ${(snap.planSavingsMinor / 100).toLocaleString("sv-SE")} ${currency} sparande`
                : "Intäkter minus utgifter"
            }
            tone={freeOk ? "positive" : "danger"}
          />
        </div>
      </section>

      {!bootstrapped ? (
        <section className="numa-panel-strong animate-rise-delay-2 space-y-4 p-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-faint)]">
            Starta här
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Fota senaste Bangkok Bank-SMS
          </h2>
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            NUMA läser hur mycket som drogs och saldot efteråt — det blir din
            startpunkt. Plan-siffrorna syns redan ovan.
          </p>
          <Link
            href="/fota"
            prefetch
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
          >
            Fota första SMS
          </Link>
        </section>
      ) : null}

      {bootstrapped ? (
        <section className="animate-rise-delay-2 grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Saldo"
            amountMinor={snap.calculatedBalanceMinor ?? 0}
            currency={currency}
            hint={snap.verificationLabel ?? "Beräknat"}
          />
          <StatTile
            label="Spenderat denna månad"
            amountMinor={snap.monthSpendingMinor}
            currency={currency}
            hint="Från bankrörelser"
          />
          <StatTile
            label="Saldo-baserat idag"
            amountMinor={snap.safeToSpendTodayMinor}
            currency={currency}
            hint="Efter reserverat i kontot"
          />
        </section>
      ) : null}

      <section className="animate-rise-delay-3 grid gap-4 md:grid-cols-2">
        <div className="numa-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Mål</h2>
            <Link href="/plan" prefetch className="text-xs font-semibold text-[var(--numa-accent)]">
              Plan
            </Link>
          </div>
          {snap.goals.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--numa-faint)]">Inga mål ännu</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {snap.goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3 last:border-0"
                >
                  <span className="text-sm text-[var(--numa-muted)]">{goal.name}</span>
                  <MoneyDisplay
                    amountMinor={goal.amountMinor}
                    currency={goal.currency}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="numa-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Senaste rörelser</h2>
            <Link
              href="/transaktioner"
              prefetch
              className="text-xs font-semibold text-[var(--numa-accent)]"
            >
              Se alla →
            </Link>
          </div>
          {snap.recent.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--numa-faint)]">
              Inga rörelser ännu
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {snap.recent.map((tx) => {
                const signed =
                  tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-[var(--numa-faint)]">
                        {tx.category ?? tx.transactionType}
                      </p>
                    </div>
                    <MoneyDisplay
                      amountMinor={signed}
                      currency={tx.currency}
                      size="sm"
                      tone="signed"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="animate-rise-delay-3 flex flex-wrap gap-3">
        <Link
          href="/plan"
          prefetch
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white sm:flex-none"
        >
          Justera plan
        </Link>
        <Link
          href="/fota"
          prefetch
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--numa-border-strong)] bg-white/70 px-5 text-sm font-semibold sm:flex-none"
        >
          Fota bank-SMS
        </Link>
        <Link
          href="/transaktioner"
          prefetch
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--numa-border-strong)] bg-white/70 px-5 text-sm font-semibold sm:flex-none"
        >
          Utgifter & intäkter
        </Link>
      </section>
    </div>
  );
}

function MiniFact({
  label,
  amountMinor,
  currency,
  hint,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint: string;
  tone?: "positive" | "danger";
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "";
  return (
    <div className="rounded-2xl bg-white/55 px-4 py-3 backdrop-blur-sm">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className={`mt-1.5 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
      <p className="mt-1 text-xs text-[var(--numa-muted)]">{hint}</p>
    </div>
  );
}

function StatTile({
  label,
  amountMinor,
  currency,
  hint,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint: string;
  tone?: "positive" | "danger";
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "";
  return (
    <div className="numa-panel p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className={`mt-2 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
      <p className="mt-2 text-xs leading-snug text-[var(--numa-muted)]">{hint}</p>
    </div>
  );
}
