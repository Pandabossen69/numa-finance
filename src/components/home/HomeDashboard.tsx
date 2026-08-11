"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import { createExpenseAction } from "@/features/finance/actions";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { homeGreeting } from "@/features/home/mock-snapshot";

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
  const greeting = homeGreeting();
  const hasCycle = Boolean(snap.cycleStartLabelSv && snap.cycleEndLabelSv);
  const remainingOk = snap.remainingFreeMinor >= 0;
  const dayOk = snap.perDayBudgetMinor > 0;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <header className="animate-rise">
        <p className="text-sm font-medium capitalize text-[var(--numa-muted)]">
          {greeting}
          {hasCycle
            ? ` · ${snap.cycleStartLabelSv} → ${snap.cycleEndLabelSv}`
            : ""}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Hem
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm text-[var(--numa-muted)]">
          {hasCycle
            ? "Så mycket du får leva på varje dag just nu."
            : "Lägg in intäkter med datum i Plan."}
        </p>
      </header>

      {!snap.hasBankTruth ? (
        <section className="numa-panel animate-rise-delay-1 space-y-3 p-5">
          <h2 className="text-base font-semibold tracking-tight">
            Fota bank-SMS för saldo
          </h2>
          <p className="text-sm text-[var(--numa-muted)]">
            Plan och dagsbudget fungerar redan utan det.
          </p>
          <Link
            href="/fota"
            prefetch
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
          >
            Fota SMS
          </Link>
        </section>
      ) : null}

      <section
        className="animate-rise-delay-1 space-y-1.5"
        aria-labelledby="spend-heading"
      >
        <p
          id="spend-heading"
          className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]"
        >
          Kvar per dag
        </p>
        <div
          className={
            dayOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"
          }
        >
          <MoneyDisplay
            amountMinor={Math.max(0, snap.perDayBudgetMinor)}
            currency={currency}
            size="xl"
          />
        </div>
        <p className="text-sm text-[var(--numa-muted)]">
          {!hasCycle
            ? "Öppna Plan och lägg till lön eller CSN."
            : `${snap.spendDaysLeft} dagar kvar${snap.cycleEndInferred ? " · slutdatum beräknat" : ""}`}
        </p>
      </section>

      <section className="animate-rise-delay-2 space-y-0">
        <OverviewRow
          label="Kvar totalt"
          amountMinor={snap.remainingFreeMinor}
          currency={currency}
          tone={remainingOk ? "positive" : "danger"}
        />
        <OverviewRow
          label="Sparar"
          amountMinor={snap.planSavingsMinor}
          currency={currency}
        />
        {snap.hasBankTruth && snap.calculatedBalanceMinor != null ? (
          <OverviewRow
            label="Saldo"
            amountMinor={snap.calculatedBalanceMinor}
            currency={currency}
            hint={snap.verificationLabel ?? undefined}
          />
        ) : null}
        {snap.cycleSpendingMinor > 0 ? (
          <OverviewRow
            label="Spenderat"
            amountMinor={snap.cycleSpendingMinor}
            currency={currency}
          />
        ) : null}
      </section>

      <QuickExpense
        accountId={snap.primaryAccountId}
        currency={currency}
        disabled={!snap.primaryAccountId}
      />

      <p className="animate-rise-delay-3 text-center text-sm text-[var(--numa-muted)]">
        <Link href="/plan" prefetch className="font-semibold text-[var(--numa-accent)]">
          Planera månader
        </Link>
        {" · "}
        <Link href="/transaktioner" prefetch className="font-semibold text-[var(--numa-accent)]">
          Alla rörelser
        </Link>
      </p>
    </div>
  );
}

function OverviewRow({
  label,
  amountMinor,
  currency,
  hint,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint?: string;
  tone?: "positive" | "danger";
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "text-[var(--numa-ink)]";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--numa-border)] pb-3">
      <div className="min-w-0">
        <p className="text-sm text-[var(--numa-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{hint}</p>
        ) : null}
      </div>
      <div className={`shrink-0 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
    </div>
  );
}

function QuickExpense({
  accountId,
  currency,
  disabled,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  disabled: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel animate-rise-delay-2 space-y-3 p-4">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--numa-muted)]">
        Snabb utgift
      </h2>

      {disabled ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Behöver ett konto —{" "}
          <Link href="/fota" className="font-semibold text-[var(--numa-accent)]">
            fota SMS
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_7.5rem_auto]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="t.ex. Lunch, Grab"
              className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-sm outline-none focus:border-[var(--numa-accent)]"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency}
              className="money min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
            <button
              type="button"
              disabled={pending || !amount.trim()}
              className="min-h-11 rounded-xl bg-[var(--numa-ink)] px-4 text-sm font-semibold text-white disabled:opacity-45"
              onClick={() => {
                if (!accountId) return;
                startTransition(async () => {
                  const result = await createExpenseAction({
                    accountId,
                    amount,
                    description: note.trim() || "Utgift",
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setError(null);
                  setAmount("");
                  setNote("");
                  router.refresh();
                });
              }}
            >
              {pending ? "…" : "Lägg till"}
            </button>
          </div>
          {error ? (
            <p className="text-sm text-[var(--numa-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
