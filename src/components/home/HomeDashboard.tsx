"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DayDial } from "@/components/home/DayDial";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { ExtraSaldoRow } from "@/components/ui/ExtraSaldoRow";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatCountSv } from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
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
  const greeting = homeGreeting(snap.displayName);
  const isBridge = snap.livingMode === "bridge";
  const isEmpty = snap.livingMode === "empty";
  const remainingOk = snap.remainingFreeMinor >= 0;
  const dayOk = snap.remainingTodayMinor > 0;
  const overToday =
    snap.dayBudgetMinor > 0 && snap.todaySpendingMinor > snap.dayBudgetMinor;
  const rangeLabel = isBridge
    ? snap.nextIncomeLabelSv
      ? `Till ${snap.nextIncomeLabelSv}`
      : null
    : snap.cycleStartLabelSv && snap.cycleEndLabelSv
      ? `${snap.cycleStartLabelSv} – ${snap.cycleEndLabelSv}`
      : null;

  const dayUsedRatio =
    snap.dayBudgetMinor > 0
      ? snap.todaySpendingMinor / snap.dayBudgetMinor
      : 0;
  const daysWord = formatCountSv(snap.spendDaysLeft, "dag", "dagar");

  const statusLine = overToday
    ? SV.overDagsbudget
    : snap.dayBudgetMinor > 0 && snap.todaySpendingMinor === 0
      ? `Hela dagsbudgeten kvar · ${daysWord}`
      : snap.dayBudgetMinor > 0
        ? `${formatMoneyHint(snap.todaySpendingMinor, currency)} av ${formatMoneyHint(snap.dayBudgetMinor, currency)}`
        : null;

  return (
    <div className="numa-page numa-page-wide space-y-6 pb-2">
      <div className="md:hidden">
        <HomescreenInstallHint />
      </div>
      <header className="animate-rise space-y-1 px-0.5">
        <p className="text-[13px] font-medium capitalize text-[var(--numa-muted)]">
          {greeting}
          {rangeLabel ? (
            <span className="text-[var(--numa-faint)]"> · {rangeLabel}</span>
          ) : null}
        </p>
        {isEmpty ? (
          <>
            <h1 className="numa-page-title">Hem</h1>
            <p className="max-w-[34ch] pt-1 text-sm leading-relaxed text-[var(--numa-muted)]">
              Lägg in intäkter under Plan — då får du en dagsbudget här.
            </p>
          </>
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
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            <section
              className="numa-panel-strong numa-day-stage animate-rise-delay-1 flex h-full min-w-0 flex-col space-y-5 px-5 pb-5 pt-6"
              aria-labelledby="spend-heading"
            >
            <div className="flex items-center justify-between gap-3 px-0.5">
              <p id="spend-heading" className="numa-section-title">
                {SV.kvarIdag}
              </p>
              {!isEmpty ? (
                <p className="text-[12px] font-medium text-[var(--numa-muted)]">
                  {daysWord}
                </p>
              ) : null}
            </div>

            {snap.dayBudgetMinor > 0 ? (
              <>
                <DayDial usedRatio={dayUsedRatio} over={overToday}>
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--numa-faint)]">
                    {overToday ? "Över" : "Kvar"}
                  </p>
                  <div
                    className={`money-hero ${
                      overToday
                        ? "text-[var(--numa-danger)]"
                        : dayOk
                          ? "text-[var(--numa-ink)]"
                          : "text-[var(--numa-muted)]"
                    }`}
                  >
                    <MoneyDisplay
                      amountMinor={Math.max(0, snap.remainingTodayMinor)}
                      currency={currency}
                      size="display"
                      compact
                    />
                  </div>
                </DayDial>

                {statusLine ? (
                  <p
                    className={`text-center text-sm leading-snug ${
                      overToday
                        ? "font-medium text-[var(--numa-danger)]"
                        : "text-[var(--numa-muted)]"
                    }`}
                  >
                    {statusLine}
                  </p>
                ) : null}

                <div className="numa-split border-t border-[var(--numa-border)] pt-1">
                  <div>
                    <p className="text-[11px] font-medium text-[var(--numa-faint)]">
                      {SV.dagsbudget}
                    </p>
                    <div className="mt-1.5 text-[var(--numa-ink)]">
                      <MoneyDisplay
                        amountMinor={snap.dayBudgetMinor}
                        currency={currency}
                        size="md"
                        compact
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--numa-faint)]">
                      Sätts på morgonen
                    </p>
                  </div>
                  <div className="numa-split-rule" aria-hidden />
                  <div>
                    <p className="text-[11px] font-medium text-[var(--numa-faint)]">
                      {SV.spenderatIdag}
                    </p>
                    <div
                      className={`mt-1.5 ${
                        overToday
                          ? "text-[var(--numa-danger)]"
                          : "text-[var(--numa-ink)]"
                      }`}
                    >
                      <MoneyDisplay
                        amountMinor={snap.todaySpendingMinor}
                        currency={currency}
                        size="md"
                        compact
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--numa-faint)]">
                      Sänker bara idag
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-6 text-center">
                <div
                  className={`money-hero mx-auto ${
                    dayOk
                      ? "text-[var(--numa-ink)]"
                      : "text-[var(--numa-muted)]"
                  }`}
                >
                  <MoneyDisplay
                    amountMinor={Math.max(0, snap.remainingTodayMinor)}
                    currency={currency}
                    size="xl"
                  />
                </div>
                {!isEmpty ? (
                  <p className="mx-auto max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                    {isBridge
                      ? "Ange ditt saldo eller fota bank-SMS — då räknas dagsbudgeten."
                      : "När planen har pengar kvar syns dagsbudgeten här."}
                  </p>
                ) : null}
              </div>
            )}
            </section>

            <div className="flex h-full min-w-0 flex-col gap-6">
              <section className="animate-rise-delay-2 space-y-2">
            <p className="numa-section-title px-1">
              {isBridge ? SV.saldo : SV.perioden}
            </p>
            <div className="numa-panel-list animate-scale-in px-4 py-1">
              <MetricRow
                label={isBridge ? SV.saldo : SV.kvarIPerioden}
                amountMinor={snap.remainingFreeMinor}
                currency={currency}
                tone={remainingOk ? "positive" : "danger"}
                hint={
                  isBridge && snap.verificationLabel
                    ? snap.verificationLabel
                    : !isBridge
                      ? "Efter planerade utgifter och det du redan spenderat"
                      : undefined
                }
              />
              <ExtraSaldoRow
                extraSaldoMinor={snap.extraSaldoMinor}
                drawnMinor={snap.extraSaldoDrawnMinor}
                hint={snap.extraSaldoHint}
                currency={currency}
              />
              {!isBridge ? (
                <MetricRow
                  label={SV.sparande}
                  amountMinor={snap.planSavingsMinor}
                  currency={currency}
                  hint="Avsatt i planen"
                />
              ) : null}
              {snap.hasBankTruth &&
              snap.calculatedBalanceMinor != null &&
              !isBridge ? (
                <MetricRow
                  label={SV.saldo}
                  amountMinor={snap.calculatedBalanceMinor}
                  currency={currency}
                  hint={snap.verificationLabel ?? "På kontot"}
                />
              ) : null}
              {!isBridge && snap.cycleSpendingMinor > 0 ? (
                <MetricRow
                  label={SV.spenderatIPerioden}
                  amountMinor={snap.cycleSpendingMinor}
                  currency={currency}
                />
              ) : null}
            </div>
          </section>

          {isBridge ? (
            <div className="animate-rise-delay-2 px-0.5 text-sm">
              <UpdateBalanceLink
                accountId={snap.primaryAccountId}
                currency={currency}
              />
            </div>
          ) : null}

              <section className="animate-rise-delay-2 mt-auto grid grid-cols-2 gap-3">
                <ActionLink href="/fota" title={SV.fota} subtitle={SV.fotaHint} />
                <ActionLink href="/plan" title={SV.plan} subtitle={SV.planHint} />
              </section>
            </div>
          </div>

          <QuickExpense
            accountId={snap.primaryAccountId}
            currency={currency}
            disabled={!snap.primaryAccountId}
            remainingTodayMinor={snap.remainingTodayMinor}
          />
        </>
      ) : null}
    </div>
  );
}

function ActionLink({
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
      className="numa-panel group flex h-full min-h-[5.25rem] min-w-0 flex-col justify-center px-4 py-3.5 transition active:scale-[0.98]"
    >
      <span className="text-sm font-semibold tracking-tight text-[var(--numa-ink)] transition group-hover:text-[var(--numa-accent-ink)]">
        {title}
      </span>
      <span className="mt-0.5 text-xs leading-snug text-[var(--numa-muted)]">
        {subtitle}
      </span>
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
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-5 pl-6">
      <div>
        <p className="numa-section-title">{SV.komIgång}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          {SV.hurMycketKvar}
        </h2>
        <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vi räknar ut en dagsbudget
          {nextIncomeLabel
            ? ` fram till ${nextIncomeLabel}`
            : " fram till nästa intäkt"}
          . När du handlar sjunker bara kvar idag.
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
              window.location.assign("/idag");
            });
          }}
        >
          {pending ? "Sparar…" : SV.visaDagsbudget}
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
        {SV.uppdateraSaldo}
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
                window.location.assign("/idag");
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
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="numa-panel animate-rise-delay-3 space-y-3.5 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="numa-section-title">{SV.laggtillUtgift}</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            {SV.laggtillUtgiftHint}
          </p>
        </div>
        {!disabled ? (
          <p className="shrink-0 text-right text-[11px] text-[var(--numa-faint)]">
            {SV.kvarIdag}
            <br />
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
            fota bank-SMS
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_7.5rem_auto]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vad? t.ex. Lunch"
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
              className="min-h-12 rounded-xl bg-[var(--numa-accent)] px-4 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45"
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
                  window.location.assign("/idag");
                });
              }}
            >
              {pending ? "…" : "Spara"}
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
