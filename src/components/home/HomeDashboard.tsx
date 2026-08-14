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
      <div className="numa-panel-strong animate-rise space-y-3 p-5">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <Link
          href="/fota"
          prefetch
          className="inline-flex text-sm font-semibold text-[var(--numa-accent)]"
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
  const overToday =
    snap.dayBudgetMinor > 0 &&
    snap.todaySpendingMinor > snap.dayBudgetMinor;
  const rangeLabel = isBridge
    ? snap.nextIncomeLabelSv
      ? `tills ${snap.nextIncomeLabelSv}`
      : null
    : snap.cycleStartLabelSv && snap.cycleEndLabelSv
      ? `${snap.cycleStartLabelSv} → ${snap.cycleEndLabelSv}`
      : null;

  const dayUsedRatio =
    snap.dayBudgetMinor > 0
      ? Math.min(1.15, snap.todaySpendingMinor / snap.dayBudgetMinor)
      : 0;
  const dayBarWidth = Math.min(100, Math.max(0, dayUsedRatio * 100));

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-2">
      <header className="animate-rise space-y-1 px-0.5">
        <p className="text-[13px] font-medium capitalize text-[var(--numa-muted)]">
          {greeting}
          {rangeLabel ? (
            <span className="text-[var(--numa-faint)]"> · {rangeLabel}</span>
          ) : null}
        </p>
        <h1 className="numa-page-title">Hem</h1>
        {isEmpty ? (
          <p className="max-w-[34ch] pt-1 text-sm leading-relaxed text-[var(--numa-muted)]">
            Lägg in intäkter i Plan så räknas din dagsbudget.
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
            className="numa-panel-strong animate-rise-delay-1 relative overflow-hidden p-5"
            aria-labelledby="spend-heading"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(13,122,102,0.16)_0%,transparent_70%)]"
              aria-hidden
            />
            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p id="spend-heading" className="numa-section-title">
                    Kvar idag
                  </p>
                  <div
                    className={`mt-2 ${
                      overToday
                        ? "text-[var(--numa-danger)]"
                        : dayOk
                          ? "text-[var(--numa-ink)]"
                          : "text-[var(--numa-muted)]"
                    }`}
                  >
                    <MoneyDisplay
                      amountMinor={Math.max(0, snap.perDayBudgetMinor)}
                      currency={currency}
                      size="xl"
                    />
                  </div>
                </div>
                {!isEmpty ? (
                  <span className="shrink-0 rounded-full bg-[var(--numa-accent-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--numa-accent-ink)]">
                    {formatCountSv(snap.spendDaysLeft, "dag", "dagar")} kvar
                  </span>
                ) : null}
              </div>

              {snap.dayBudgetMinor > 0 ? (
                <div className="space-y-2">
                  <div className="numa-progress h-2" aria-hidden>
                    <span
                      className="animate-bar"
                      style={{
                        width: `${Math.max(dayBarWidth > 0 ? 6 : 0, dayBarWidth)}%`,
                        ...(overToday
                          ? {
                              background:
                                "linear-gradient(90deg, var(--numa-danger) 0%, #d94a3d 100%)",
                            }
                          : undefined),
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Dagsbudget"
                      amountMinor={snap.dayBudgetMinor}
                      currency={currency}
                    />
                    <MiniStat
                      label="Spenderat idag"
                      amountMinor={snap.todaySpendingMinor}
                      currency={currency}
                      tone={overToday ? "danger" : undefined}
                    />
                  </div>
                </div>
              ) : !isEmpty ? (
                <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                  {isBridge
                    ? "Ange saldo eller fota bank-SMS så räknas dagsbudgeten."
                    : "När planen har fritt utrymme syns dagsbudgeten här."}
                </p>
              ) : null}
            </div>
          </section>

          <section className="numa-panel-list animate-rise-delay-2 animate-scale-in px-4 py-1">
            <MetricRow
              label={isBridge ? "Saldo" : "Kvar totalt"}
              amountMinor={snap.remainingFreeMinor}
              currency={currency}
              tone={remainingOk ? "positive" : "danger"}
              hint={
                isBridge && snap.verificationLabel
                  ? snap.verificationLabel
                  : !isBridge
                    ? "Hela perioden"
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
                label="Spenderat i perioden"
                amountMinor={snap.cycleSpendingMinor}
                currency={currency}
              />
            ) : null}
          </section>

          {isBridge ? (
            <div className="animate-rise-delay-2 px-0.5 text-sm">
              <UpdateBalanceLink
                accountId={snap.primaryAccountId}
                currency={currency}
              />
            </div>
          ) : null}

          <section className="animate-rise-delay-2 grid grid-cols-2 gap-3">
            <ActionCard
              href="/fota"
              title="Fota"
              subtitle="Kvitto eller SMS"
            />
            <ActionCard href="/plan" title="Plan" subtitle="Intäkter & hinkar" />
          </section>

          <QuickExpense
            accountId={snap.primaryAccountId}
            currency={currency}
            disabled={!snap.primaryAccountId}
            remainingTodayMinor={snap.perDayBudgetMinor}
          />
        </>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  amountMinor,
  currency,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  tone?: "danger";
}) {
  return (
    <div className="rounded-2xl bg-[rgba(10,26,20,0.035)] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--numa-faint)]">{label}</p>
      <div
        className={`mt-1 ${
          tone === "danger"
            ? "text-[var(--numa-danger)]"
            : "text-[var(--numa-ink)]"
        }`}
      >
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="sm"
          compact
        />
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="numa-panel flex min-h-[4.75rem] flex-col justify-center px-4 py-3 transition active:scale-[0.98]"
    >
      <span className="text-sm font-semibold text-[var(--numa-ink)]">{title}</span>
      <span className="mt-0.5 text-xs text-[var(--numa-muted)]">{subtitle}</span>
    </Link>
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
        <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vi sätter en dagsbudget
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
          className="money min-h-12 flex-1 rounded-xl border border-[var(--numa-border)] bg-white/90 px-4 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
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
    <span className="mt-1 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => {
            setBalance(e.target.value);
            setError(null);
          }}
          placeholder={currency}
          className="money min-h-11 w-32 rounded-xl border border-[var(--numa-border)] bg-white/90 px-3 text-base font-semibold"
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
  remainingTodayMinor,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  disabled: boolean;
  remainingTodayMinor: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel animate-rise-delay-3 space-y-3.5 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="numa-section-title">Snabb utgift</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            Dras från dagens budget
          </p>
        </div>
        {!disabled ? (
          <p className="shrink-0 text-right text-[11px] text-[var(--numa-faint)]">
            Kvar{" "}
            <span className="font-semibold text-[var(--numa-ink)]">
              {formatMoneyHint(remainingTodayMinor, currency)}
            </span>
          </p>
        ) : null}
      </div>

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
              className="min-h-12 rounded-xl border border-[var(--numa-border)] bg-white/90 px-3.5 text-base outline-none focus:border-[var(--numa-accent)]"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency}
              className="money min-h-12 rounded-xl border border-[var(--numa-border)] bg-white/90 px-3.5 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
            <button
              type="button"
              disabled={pending || !amount.trim()}
              className="min-h-12 rounded-xl bg-[var(--numa-accent)] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(13,122,102,0.25)] transition active:scale-[0.98] disabled:opacity-45"
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
