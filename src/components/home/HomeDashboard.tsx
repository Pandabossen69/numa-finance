"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatCountSv } from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import {
  createExpenseAction,
  setAvailableNowAction,
} from "@/features/finance/actions";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { homeGreeting } from "@/features/home/mock-snapshot";

function formatMoneyHint(amountMinor: number, currency: CurrencyCode): string {
  return formatMoney(money(Math.max(0, amountMinor), currency));
}
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
        <Link
          href="/fota"
          prefetch
          className="text-sm font-semibold text-[var(--numa-accent)]"
        >
          Gå till Fota →
        </Link>
      </div>
    );
  }

  const currency = snap.currency;
  const greeting = homeGreeting();
  const isBridge = snap.livingMode === "bridge";
  const isEmpty = snap.livingMode === "empty";
  const remainingOk = snap.remainingFreeMinor >= 0;
  const dayOk = snap.perDayBudgetMinor > 0;
  const rangeLabel = isBridge
    ? snap.nextIncomeLabelSv
      ? `tills ${snap.nextIncomeLabelSv}`
      : null
    : snap.cycleStartLabelSv && snap.cycleEndLabelSv
      ? `${snap.cycleStartLabelSv} → ${snap.cycleEndLabelSv}`
      : null;

  const poolBase =
    snap.cycleSpendingMinor + Math.max(0, snap.remainingFreeMinor);
  const spendProgress =
    !isEmpty && poolBase > 0
      ? Math.min(1, Math.max(0, snap.cycleSpendingMinor / poolBase))
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-9">
      <header className="animate-rise space-y-1">
        <p className="text-sm font-medium capitalize text-[var(--numa-muted)]">
          {greeting}
          {rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
        <h1 className="numa-page-title">Hem</h1>
        {isEmpty ? (
          <p className="max-w-[32ch] pt-1 text-sm text-[var(--numa-muted)]">
            Lägg in intäkter i Plan.
          </p>
        ) : null}
      </header>

      {snap.needsAvailableInput ? (
        <AvailableNowCard
          accountId={snap.primaryAccountId}
          currency={currency}
          nextIncomeLabel={snap.nextIncomeLabelSv}
        />
      ) : null}

      {!snap.needsAvailableInput ? (
        <>
          <section
            className="animate-rise-delay-1 space-y-3"
            aria-labelledby="spend-heading"
          >
            <p id="spend-heading" className="numa-section-title">
              Kvar idag
            </p>
            <div
              className={
                dayOk
                  ? "money-hero text-[var(--numa-ink)]"
                  : "money-hero text-[var(--numa-muted)]"
              }
            >
              <MoneyDisplay
                amountMinor={Math.max(0, snap.perDayBudgetMinor)}
                currency={currency}
                size="xl"
              />
            </div>
            {!isEmpty ? (
              <p className="text-sm text-[var(--numa-muted)]">
                {snap.dayBudgetMinor > 0
                  ? `Dagsbudget ${formatMoneyHint(snap.dayBudgetMinor, currency)}`
                  : null}
                {snap.dayBudgetMinor > 0 && snap.todaySpendingMinor > 0
                  ? ` · spenderat ${formatMoneyHint(snap.todaySpendingMinor, currency)}`
                  : ""}
                {snap.dayBudgetMinor > 0 ? " · " : ""}
                {isBridge
                  ? `${formatCountSv(snap.spendDaysLeft, "dag", "dagar")} till nästa intäkt`
                  : `${formatCountSv(snap.spendDaysLeft, "dag", "dagar")} kvar`}
              </p>
            ) : null}
            {spendProgress != null && snap.cycleSpendingMinor > 0 ? (
              <div
                className="numa-progress animate-bar max-w-xs"
                aria-hidden
              >
                <span
                  style={{ width: `${Math.max(8, spendProgress * 100)}%` }}
                />
              </div>
            ) : null}
          </section>

          <section className="animate-rise-delay-2 animate-scale-in space-y-0">
            <MetricRow
              label={isBridge ? "Saldo" : "Kvar totalt"}
              amountMinor={snap.remainingFreeMinor}
              currency={currency}
              tone={remainingOk ? "positive" : "danger"}
              hint={
                isBridge && snap.verificationLabel
                  ? snap.verificationLabel
                  : undefined
              }
            />
            {!isBridge ? (
              <MetricRow
                label="Sparar"
                amountMinor={snap.planSavingsMinor}
                currency={currency}
              />
            ) : null}
            {snap.hasBankTruth &&
            snap.calculatedBalanceMinor != null &&
            !isBridge ? (
              <MetricRow
                label="Saldo"
                amountMinor={snap.calculatedBalanceMinor}
                currency={currency}
                hint={snap.verificationLabel ?? undefined}
              />
            ) : null}
            {!isBridge && snap.cycleSpendingMinor > 0 ? (
              <MetricRow
                label="Spenderat"
                amountMinor={snap.cycleSpendingMinor}
                currency={currency}
              />
            ) : null}
          </section>

          {isBridge ? (
            <div className="text-sm text-[var(--numa-muted)]">
              <UpdateBalanceLink
                accountId={snap.primaryAccountId}
                currency={currency}
              />
            </div>
          ) : null}

          <QuickExpense
            accountId={snap.primaryAccountId}
            currency={currency}
            disabled={!snap.primaryAccountId}
          />
        </>
      ) : null}
    </div>
  );
}

function AvailableNowCard({
  accountId,
  currency,
  nextIncomeLabel,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  nextIncomeLabel: string | null;
}) {
  const router = useRouter();
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-5 pl-6">
      <div>
        <p className="numa-section-title">Kom igång</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Hur mycket har du kvar?
        </h2>
        <p className="mt-1 max-w-[36ch] text-sm text-[var(--numa-muted)]">
          Vi delar upp det per dag
          {nextIncomeLabel ? ` tills ${nextIncomeLabel}` : " tills nästa intäkt"}
          .
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder={`Belopp (${currency})`}
          className="money min-h-12 flex-1 rounded-xl border border-[var(--numa-border)] bg-white/80 px-4 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
        />
        <button
          type="button"
          disabled={pending || !balance.trim()}
          className="numa-cta-glow min-h-12 rounded-xl bg-[var(--numa-ink)] px-5 text-sm font-semibold text-white disabled:opacity-45"
          onClick={() => {
            startTransition(async () => {
              const result = await setAvailableNowAction({
                balance,
                accountId,
                currency,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              router.refresh();
            });
          }}
        >
          {pending ? "Sparar…" : "Visa budget"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function UpdateBalanceLink({
  accountId,
  currency,
}: {
  accountId: string | null;
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        className="font-semibold text-[var(--numa-accent)]"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Uppdatera belopp
      </button>
    );
  }

  return (
    <span className="mt-2 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => {
            setBalance(e.target.value);
            setError(null);
          }}
          placeholder={currency}
          className="money min-h-11 w-32 rounded-lg border border-[var(--numa-border)] bg-white/80 px-3 text-base font-semibold"
        />
        <button
          type="button"
          disabled={pending || !balance.trim()}
          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--numa-accent)] disabled:opacity-45"
          onClick={() => {
            startTransition(async () => {
              const result = await setAvailableNowAction({
                balance,
                accountId,
                currency,
              });
              if (result.ok) {
                setOpen(false);
                setBalance("");
                setError(null);
                router.refresh();
                return;
              }
              setError(result.error);
            });
          }}
        >
          Spara
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--numa-muted)]"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Avbryt
        </button>
      </span>
      {error ? (
        <span className="text-xs text-[var(--numa-danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </span>
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
    <section className="numa-panel animate-rise-delay-2 space-y-3 p-4 pl-5">
      <h2 className="numa-section-title">Snabb utgift</h2>

      {disabled ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Behöver ett konto —{" "}
          <Link
            href="/fota"
            prefetch
            className="font-semibold text-[var(--numa-accent)]"
          >
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
              className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-base outline-none focus:border-[var(--numa-accent)]"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency}
              className="money min-h-11 rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
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
