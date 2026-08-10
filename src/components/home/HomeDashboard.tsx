"use client";

import { useEffect, useState } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { calculateDayPulse } from "@/domain/gamification";
import { money, type CurrencyCode } from "@/domain/money";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";
import { homeGreeting } from "@/features/home/mock-snapshot";

function pulseCopy(
  status: "plus" | "even" | "minus",
  deltaMinor: number,
  bootstrapped: boolean,
) {
  if (!bootstrapped) {
    return {
      label: "Väntar på första SMS",
      detail: "Fotografera Bangkok Bank-SMS för att sätta saldot",
      tone: "neutral" as const,
    };
  }
  if (status === "plus") {
    return {
      label: "Plus mot dagens plan",
      detail: "Du ligger under dagens trygga nivå",
      tone: "positive" as const,
    };
  }
  if (status === "minus") {
    return {
      label: "Över dagens plan",
      detail: `Överskridet med ${(Math.abs(deltaMinor) / 100).toLocaleString("sv-SE")} THB`,
      tone: "danger" as const,
    };
  }
  return {
    label: "Exakt på planen",
    detail: "Dagens budget är använd",
    tone: "neutral" as const,
  };
}

export function HomeDashboard() {
  const [snap, setSnap] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getHomeSnapshotAction();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSnap(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-[var(--numa-muted)]">Hämtar din ekonomi…</p>
    );
  }

  if (error || !snap) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
      </div>
    );
  }

  const currency = snap.currency;
  const bootstrapped = snap.hasBankTruth;
  const pulse = calculateDayPulse({
    safeToSpendToday: money(snap.safeToSpendTodayMinor, currency),
    spentToday: money(snap.todaySpendingMinor, currency),
  });
  const copy = pulseCopy(pulse.status, pulse.delta.amountMinor, bootstrapped);
  const used = bootstrapped
    ? Math.min(140, Math.max(0, pulse.usedPercent))
    : 0;
  const greeting = homeGreeting();

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="animate-rise">
        <p className="text-sm font-medium text-[var(--numa-muted)]">
          {greeting} · Bangkok
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)] md:text-4xl">
          Hem
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          {bootstrapped
            ? "Hur mycket du faktiskt kan använda — inte bara vad kontot visar."
            : "Allt står på noll tills du importerar första bank-SMS:et."}
        </p>
      </header>

      {!bootstrapped ? (
        <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-faint)]">
            Starta här
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Fota senaste Bangkok Bank-SMS
          </h2>
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            NUMA läser hur mycket som drogs och saldot efteråt — det blir din
            startpunkt. Inga siffror innan dess.
          </p>
          <a
            href="/fota"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
          >
            Fota första SMS
          </a>
        </section>
      ) : null}

      <section
        className="numa-panel-strong animate-rise-delay-1 relative overflow-hidden p-6 md:p-8"
        aria-labelledby="safe-today-heading"
      >
        <p
          id="safe-today-heading"
          className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--numa-faint)]"
        >
          Tryggt att spendera idag
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <MoneyDisplay
            amountMinor={snap.safeToSpendTodayMinor}
            currency={currency}
            size="xl"
          />
          <span className="mb-1 rounded-full bg-[var(--numa-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--numa-accent-ink)]">
            {snap.daysUntilIncome} dagar till inkomst
          </span>
        </div>
        <p className="mt-3 text-sm text-[var(--numa-muted)]">
          Efter reserverat och buffert · vecka{" "}
          <MoneyDisplay
            amountMinor={snap.safeToSpendWeekMinor}
            currency={currency}
            size="sm"
          />
        </p>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs font-medium">
            <span
              className={
                copy.tone === "positive"
                  ? "text-[var(--numa-positive)]"
                  : copy.tone === "danger"
                    ? "text-[var(--numa-danger)]"
                    : "text-[var(--numa-muted)]"
              }
            >
              {copy.label}
            </span>
            <span className="text-[var(--numa-faint)]">
              Spenderat{" "}
              <MoneyDisplay
                amountMinor={snap.todaySpendingMinor}
                currency={currency}
                size="sm"
              />
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--numa-bg-deep)]">
            <div
              className={`h-full rounded-full ${
                copy.tone === "danger"
                  ? "bg-[var(--numa-danger)]"
                  : "bg-[var(--numa-accent)]"
              }`}
              style={{ width: `${used}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--numa-faint)]">{copy.detail}</p>
        </div>
      </section>

      <section className="animate-rise-delay-2 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Saldo"
          amountMinor={snap.calculatedBalanceMinor ?? 0}
          currency={currency}
          hint={
            snap.verificationLabel ??
            (bootstrapped ? "Beräknat" : "Väntar på första SMS")
          }
        />
        <StatTile
          label="Reserverat"
          amountMinor={snap.reservedMinor}
          currency={currency}
          hint="Planerade kostnader & mål"
        />
        <StatTile
          label="Fritt efter buffert"
          amountMinor={snap.freeMinor}
          currency={currency}
          hint={`Buffert ${(snap.bufferMinor / 100).toLocaleString("sv-SE")} THB`}
        />
      </section>

      <section className="animate-rise-delay-2 grid gap-4 md:grid-cols-2">
        <div className="numa-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Mål</h2>
            <a href="/plan" className="text-xs font-semibold text-[var(--numa-accent)]">
              Plan
            </a>
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
            <a
              href="/transaktioner"
              className="text-xs font-semibold text-[var(--numa-accent)]"
            >
              Se alla →
            </a>
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
        <a
          href="/fota"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white sm:flex-none"
        >
          Fota bank-SMS
        </a>
        <a
          href="/transaktioner"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--numa-border-strong)] bg-white/70 px-5 text-sm font-semibold sm:flex-none"
        >
          Utgifter & intäkter
        </a>
        <a
          href="/plan"
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-[var(--numa-border-strong)] bg-white/70 px-5 text-sm font-semibold sm:flex-none"
        >
          Justera plan
        </a>
      </section>
    </div>
  );
}

function StatTile({
  label,
  amountMinor,
  currency,
  hint,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint: string;
}) {
  return (
    <div className="numa-panel p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className="mt-2">
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
      <p className="mt-2 text-xs leading-snug text-[var(--numa-muted)]">{hint}</p>
    </div>
  );
}
