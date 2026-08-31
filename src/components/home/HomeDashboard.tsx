"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import Link from "next/link";
import { DayDial } from "@/components/home/DayDial";
import { HomescreenInstallHint } from "@/components/pwa/HomescreenInstallHint";
import { ExtraSaldoRow } from "@/components/ui/ExtraSaldoRow";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { CompactPiles } from "@/components/ui/WealthScoreboard";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { GettingStartedCard } from "@/components/home/GettingStartedCard";
import { warmupPlanPageData } from "@/components/plan/plan-cache";
import { formatDaysUntilSv } from "@/domain/finance";
import {
  formatMoney,
  formatMoneyCompact,
  money,
  parseUiAmountToMinor,
  type CurrencyCode,
} from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
import { createExpenseAction, setAvailableNowAction } from "@/features/finance/actions";
import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { GettingStartedView } from "@/features/getting-started/progress";
import {
  applyAccountBalance,
  applyAccountDelta,
  applyMovementsAdd,
  applyOptimisticHomeSpend,
  isAccountsDirty,
  isHomeDirty,
  lastAccountsSnapshot,
  lastGettingStarted,
  lastHomeSnapshot,
  rememberAccountsSnapshot,
  rememberGettingStarted,
  rememberHomeSnapshot,
  revertOptimisticHomeSpend,
  subscribeAccountsSnapshot,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { homeGreeting } from "@/features/home/mock-snapshot";
import { HomeViewLoading } from "@/components/layout/ViewLoading";

function formatMoneyHint(amountMinor: number, currency: CurrencyCode): string {
  return formatMoneyCompact(money(amountMinor, currency));
}

export function HomeDashboard({
  snap,
  error,
  accounts = null,
  gettingStarted = null,
}: {
  snap: HomeSnapshot | null;
  error?: string | null;
  accounts?: AccountsSnapshot | null;
  gettingStarted?: GettingStartedView | null;
}) {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    lastHomeSnapshot,
  );
  const accountsView = useSyncExternalStore(
    subscribeAccountsSnapshot,
    lastAccountsSnapshot,
    lastAccountsSnapshot,
  );
  const sameOwner = !stored || !snap || stored.userId === snap.userId;
  const view = (sameOwner ? stored : null) ?? snap ?? lastHomeSnapshot();

  useEffect(() => {
    // Adopt the server snap unless an optimistic spend is in flight.
    // The old "== null" guard left Hem stuck on the first in-memory
    // snapshot (often 0) after saldo, Fota, or a later RSC load.
    if (snap && !isHomeDirty()) rememberHomeSnapshot(snap);
    if (accounts && (lastAccountsSnapshot() == null || !isAccountsDirty())) {
      rememberAccountsSnapshot(accounts);
    }
    if (gettingStarted && lastGettingStarted() == null) {
      rememberGettingStarted(gettingStarted);
    }
    void warmupPlanPageData();
  }, [snap, accounts, gettingStarted]);

  useEffect(() => {
    if (stored || snap) return;
    let cancelled = false;
    void getHomeSnapshotAction().then((result) => {
      if (cancelled || !result.ok) return;
      rememberHomeSnapshot(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [stored, snap]);

  if (!view) {
    if (!error) return <HomeViewLoading />;
    return (
      <div className="numa-panel-strong animate-rise space-y-3 p-5">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const remainingTodayMinor = view.remainingTodayMinor;
  const todaySpendingMinor = view.todaySpendingMinor;
  const currency = view.currency;
  const greeting = homeGreeting(view.displayName, new Date(), view.timeZone);
  const isBridge = view.livingMode === "bridge";
  const isEmpty = view.livingMode === "empty";
  const hasSaldo = view.calculatedBalanceMinor != null;
  const dayOk = remainingTodayMinor > 0;
  const overToday = view.dayBudgetMinor > 0 && todaySpendingMinor > view.dayBudgetMinor;
  const dialCenterMinor = remainingTodayMinor;
  const rangeLabel = isBridge
    ? view.nextIncomeLabelSv
      ? `Till ${view.nextIncomeLabelSv}`
      : null
    : view.cycleStartLabelSv && view.cycleEndLabelSv
      ? `${view.cycleStartLabelSv} – ${view.cycleEndLabelSv}`
      : null;

  const dayUsedRatio =
    view.dayBudgetMinor > 0 ? todaySpendingMinor / view.dayBudgetMinor : 0;
  const daysWord = formatDaysUntilSv(view.spendDaysLeft);

  const statusLine = overToday
    ? SV.overDagsbudget
    : view.dayBudgetMinor > 0 && todaySpendingMinor === 0
      ? `Hela dagsbudgeten kvar · ${daysWord}`
      : view.dayBudgetMinor > 0
        ? `${formatMoneyHint(remainingTodayMinor, currency)} av ${formatMoneyHint(view.dayBudgetMinor, currency)} kvar`
        : null;

  return (
    <div className="numa-page numa-page-wide min-w-0 space-y-6">
      <header className="animate-rise min-w-0 space-y-1 px-0.5">
        <p className="min-w-0 text-[14px] leading-relaxed font-medium text-[var(--numa-muted)]">
          {greeting}
          {rangeLabel ? (
            <span className="text-[var(--numa-faint)]"> · {rangeLabel}</span>
          ) : null}
        </p>
        {isEmpty ? (
          <>
            <h1 className="numa-page-title">Hem</h1>
            <p className="max-w-[34ch] pt-1 text-sm leading-relaxed text-[var(--numa-muted)]">
              Saldo, det som kommer in och det som måste betalas — läget just nu.
            </p>
          </>
        ) : null}
      </header>

      {view.needsAvailableInput ? (
        <AvailableNowCard
          accountId={view.primaryAccountId}
          currency={currency}
          nextIncomeLabel={view.nextIncomeLabelSv}
        />
      ) : null}

      {!view.needsAvailableInput ? (
        <>
          <div className="grid min-w-0 items-stretch gap-5 md:grid-cols-2 md:gap-6">
            <section
              className={[
                "numa-panel-strong numa-day-stage cursor-default animate-rise-delay-1 flex h-full min-w-0 flex-col space-y-4 px-4 pt-4 pb-4 md:space-y-5 md:px-5 md:pt-5 md:pb-5",
                overToday ? "is-over" : null,
                // No dagsbudget yet: hug the copy instead of stretching to
                // match the piles column and leaving a tall empty card.
                view.dayBudgetMinor > 0 ? null : "md:h-auto md:self-start",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-labelledby="spend-heading"
            >
              <div className="flex min-w-0 items-center justify-between gap-3 px-1">
                <p id="spend-heading" className="numa-section-title min-w-0">
                  {SV.kvarIdag}
                </p>
                {!isEmpty ? (
                  <p className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--numa-card)_64%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--numa-muted)] ring-1 ring-[var(--numa-border)]">
                    {daysWord}
                  </p>
                ) : null}
              </div>

              {view.dayBudgetMinor > 0 ? (
                <>
                  <DayDial usedRatio={dayUsedRatio} over={overToday}>
                    {overToday ? (
                      <p className="numa-chip numa-chip-alarm mb-2">Över</p>
                    ) : (
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[var(--numa-accent)] uppercase">
                        Kvar
                      </p>
                    )}
                    <div
                      className={`money-hero ${
                        overToday
                          ? "text-[var(--numa-ink)]"
                          : dayOk
                            ? "text-[var(--numa-ink)]"
                            : "text-[var(--numa-muted)]"
                      }`}
                    >
                      <MoneyDisplay
                        amountMinor={dialCenterMinor}
                        currency={currency}
                        size="display"
                        compact
                        tone={
                          overToday || remainingTodayMinor < 0
                            ? "signed"
                            : "neutral"
                        }
                        wrap={false}
                      />
                    </div>
                  </DayDial>

                  {statusLine ? (
                    <p
                      className={`min-h-5 min-w-0 px-1 text-center text-[13px] leading-snug ${
                        overToday
                          ? "font-medium text-[var(--numa-muted)]"
                          : "text-[var(--numa-muted)]"
                      }`}
                    >
                      {statusLine}
                    </p>
                  ) : null}

                  <div className="numa-day-metrics">
                    <div className="is-budget">
                      <p className="numa-metric-label">{SV.dagsbudget}</p>
                      <div className="numa-metric-value text-[var(--numa-ink)]">
                        <MoneyDisplay
                          amountMinor={view.dayBudgetMinor}
                          currency={currency}
                          size="md"
                          align="start"
                          wrap={false}
                        />
                      </div>
                      <p className="numa-metric-hint">Sätts på morgonen</p>
                    </div>
                    <div className="is-spent">
                      <p className="numa-metric-label">{SV.spenderatIdag}</p>
                      <div
                        className={`numa-metric-value ${
                          overToday
                            ? "text-[var(--numa-alarm)]"
                            : "text-[var(--numa-ink)]"
                        }`}
                      >
                        <MoneyDisplay
                          amountMinor={todaySpendingMinor}
                          currency={currency}
                          size="md"
                          align="start"
                          wrap={false}
                        />
                      </div>
                      <p className="numa-metric-hint">Sänker bara idag</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3 py-6 text-center">
                  {isEmpty ? (
                    <p className="mx-auto max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                      {hasSaldo
                        ? "Ingen dagsbudget än. Lägg in vad som kommer in i Plan."
                        : "Ingen dagsbudget än. Sätt saldo så räknas kvar idag."}
                    </p>
                  ) : (
                    <>
                      <div
                        className={`money-hero mx-auto ${
                          dayOk
                            ? "text-[var(--numa-ink)]"
                            : "text-[var(--numa-muted)]"
                        }`}
                      >
                        <MoneyDisplay
                          amountMinor={remainingTodayMinor}
                          currency={currency}
                          size="xl"
                          compact
                          tone={remainingTodayMinor < 0 ? "signed" : "neutral"}
                          wrap={false}
                        />
                      </div>
                      <p className="mx-auto max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                        {isBridge
                          ? "Ange ditt saldo eller fota bank-SMS — då räknas dagsbudgeten."
                          : "När planen har pengar kvar syns dagsbudgeten här."}
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>

            <div className="flex h-full min-w-0 flex-col gap-5 md:gap-6">
              <section className="animate-rise-delay-2 min-w-0 space-y-2">
                <p className="numa-section-title px-1">{SV.saldoOchSparande}</p>
                <p className="px-1 text-[12px] leading-snug text-[var(--numa-faint)]">
                  {SV.saldoAllaKontonHint}
                </p>
                <CompactPiles
                  saldoMinor={view.calculatedBalanceMinor}
                  incomingMinor={view.incomingMinor}
                  unpaidMinor={view.unpaidMinor}
                  overMinor={view.overMinor}
                  savingsMinor={view.savingsTotalMinor}
                  currency={currency}
                />
                {accountsView && accountsView.accounts.length > 0 ? (
                  <Link
                    href="/konton"
                    className="numa-press numa-panel-list flex items-center justify-between gap-3 px-4 py-3 transition hover:border-[var(--numa-border-strong)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-tight">
                        {accountsView.accounts.length === 1
                          ? accountsView.accounts[0]!.name
                          : `${accountsView.accounts.length} konton`}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--numa-faint)]">
                        {accountsView.accounts.length === 1
                          ? "Se och uppdatera →"
                          : accountsView.accounts
                              .map((a) => a.name)
                              .slice(0, 3)
                              .join(" · ") +
                            (accountsView.accounts.length > 3 ? "…" : "")}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--numa-accent)]">
                      Konton →
                    </span>
                  </Link>
                ) : (
                  <Link
                    href="/konton"
                    className="numa-press block px-1 text-[13px] font-semibold text-[var(--numa-accent)]"
                  >
                    Lägg till konto →
                  </Link>
                )}
                {view.extraCarriedInMinor > 0 ||
                view.extraSaldoMinor > 0 ||
                view.extraSaldoDrawnMinor > 0 ||
                (!isBridge && view.cycleSpendingMinor > 0) ? (
                  <div className="numa-panel-list animate-scale-in px-4 py-1">
                    {view.extraCarriedInMinor > 0 ? (
                      <MetricRow
                        label={SV.extraMed}
                        amountMinor={view.extraCarriedInMinor}
                        currency={currency}
                        tone="positive"
                        hint={view.extraSaldoHint ?? "Följde med från tidigare månader"}
                      />
                    ) : (
                      <ExtraSaldoRow
                        extraSaldoMinor={view.extraSaldoMinor}
                        drawnMinor={view.extraSaldoDrawnMinor}
                        hint={view.extraSaldoHint}
                        currency={currency}
                      />
                    )}
                    {!isBridge && view.cycleSpendingMinor > 0 ? (
                      <MetricRow
                        label={SV.spenderatIPerioden}
                        amountMinor={view.cycleSpendingMinor}
                        currency={currency}
                      />
                    ) : null}
                  </div>
                ) : null}
              </section>

              {isBridge ? (
                <div className="animate-rise-delay-2 px-0.5 text-sm">
                  <UpdateBalanceLink
                    accountId={view.primaryAccountId}
                    currency={currency}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="md:hidden">
            <HomescreenInstallHint variant="bar" />
          </div>

          <QuickExpense
            accountId={view.primaryAccountId}
            currency={currency}
            disabled={!view.primaryAccountId}
            remainingTodayMinor={remainingTodayMinor}
            overToday={overToday}
            onOptimisticSpend={(amountMinor) => applyOptimisticHomeSpend(amountMinor)}
            onSpendFailed={(amountMinor) => revertOptimisticHomeSpend(amountMinor)}
          />
        </>
      ) : null}

      {gettingStarted?.visible ? <GettingStartedCard view={gettingStarted} /> : null}
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
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useSubmitGuard(busy);

  return (
    <section className="numa-panel-strong animate-rise-delay-1 space-y-4 p-5">
      <div>
        <p className="numa-section-title">{SV.komIgång}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{SV.hurMycketKvar}</h2>
        <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vi räknar ut en dagsbudget
          {nextIncomeLabel ? ` fram till ${nextIncomeLabel}` : " fram till nästa intäkt"}.
          När du handlar sjunker bara kvar idag.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder={`Belopp (${currency})`}
          className="money min-h-12 flex-1 rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
        />
        <button
          type="button"
          disabled={busy || !balance.trim()}
          className="numa-btn numa-btn-primary numa-cta-glow min-h-12 px-5"
          onClick={() => {
            if (busy || !balance.trim()) return;
            if (!guard.tryBegin()) return;
            setBusy(true);
            setError(null);
            void (async () => {
              const result = await setAvailableNowAction({
                balance,
                accountId,
                currency,
              });
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              try {
                applyAccountBalance(accountId ?? "", parseUiAmountToMinor(balance));
              } catch {
                // Snapshot below fills in the living numbers.
              }
              void getHomeSnapshotAction().then((next) => {
                if (next.ok) rememberHomeSnapshot(next.data);
              });
              void warmupPlanPageData();
            })();
          }}
        >
          {busy ? "Sparar…" : SV.visaDagsbudget}
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
  const [busy, setBusy] = useState(false);
  const guard = useSubmitGuard(busy);

  if (!open) {
    return (
      <button
        type="button"
        className="numa-press inline-flex min-h-11 items-center font-semibold text-[var(--numa-accent)]"
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
          className="money min-h-11 w-32 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 text-base font-semibold"
        />
        <button
          type="button"
          disabled={busy || !balance.trim()}
          className="numa-btn numa-btn-soft min-h-11 px-3 text-sm"
          onClick={() => {
            if (busy || !balance.trim()) return;
            if (!guard.tryBegin()) return;
            setBusy(true);
            setError(null);
            void (async () => {
              const result = await setAvailableNowAction({
                balance,
                accountId,
                currency,
              });
              setBusy(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              setBalance("");
              try {
                applyAccountBalance(accountId ?? "", parseUiAmountToMinor(balance));
              } catch {
                // Snapshot below fills in the living numbers.
              }
              void getHomeSnapshotAction().then((next) => {
                if (next.ok) rememberHomeSnapshot(next.data);
              });
              void warmupPlanPageData();
            })();
          }}
        >
          {busy ? "Sparar…" : "Spara"}
        </button>
        <button
          type="button"
          className="numa-press inline-flex min-h-11 items-center px-2 text-sm text-[var(--numa-muted)]"
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
  overToday,
  onOptimisticSpend,
  onSpendFailed,
}: {
  accountId: string | null;
  currency: CurrencyCode;
  disabled: boolean;
  remainingTodayMinor: number;
  overToday: boolean;
  onOptimisticSpend: (amountMinor: number) => void;
  onSpendFailed: (amountMinor: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Guard only — never flip a busy "saving…" flag; dial updates instantly.
  const guard = useSubmitGuard();

  return (
    <section className="numa-panel animate-rise-delay-3 space-y-3.5 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="numa-section-title">{SV.laggtillUtgift}</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">{SV.laggtillUtgiftHint}</p>
        </div>
        {!disabled ? (
          <p className="min-w-0 text-[11px] text-[var(--numa-faint)] sm:shrink-0 sm:text-right">
            {overToday || remainingTodayMinor < 0 ? SV.overDagsbudget : SV.kvarIdag}
            <br />
            <span
              className={`font-semibold ${
                remainingTodayMinor < 0
                  ? "text-[var(--numa-alarm)]"
                  : "text-[var(--numa-ink)]"
              }`}
            >
              {formatMoney(money(remainingTodayMinor, currency))}
            </span>
          </p>
        ) : null}
      </div>

      {disabled ? (
        <p className="text-sm text-[var(--numa-muted)]">
          Behöver ett konto —{" "}
          <Link href="/fota" prefetch className="font-semibold text-[var(--numa-accent)]">
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
              aria-label="Anteckning"
              className="min-h-12 rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3.5 text-base outline-none focus:border-[var(--numa-accent)]"
            />
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency}
              aria-label="Belopp"
              className="money min-h-12 rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3.5 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
            <button
              type="button"
              disabled={!amount.trim()}
              className="numa-btn numa-btn-accent min-h-12 px-4"
              onClick={() => {
                if (guard.isRunning() || !accountId) return;
                let amountMinor: number;
                try {
                  amountMinor = parseUiAmountToMinor(amount);
                } catch {
                  setError("Ogiltigt belopp");
                  return;
                }
                if (amountMinor <= 0) {
                  setError("Beloppet måste vara större än 0");
                  return;
                }
                if (!guard.tryBegin()) return;
                const description = note.trim() || "Utgift";
                const amountInput = amount;
                setError(null);
                setAmount("");
                setNote("");
                // Instant UI — dial + konton; server + rörelser catch up.
                onOptimisticSpend(amountMinor);
                applyAccountDelta(-amountMinor, accountId);
                void (async () => {
                  try {
                    const result = await createExpenseAction({
                      accountId,
                      amount: amountInput,
                      description,
                    });
                    if (!result.ok) {
                      onSpendFailed(amountMinor);
                      applyAccountDelta(amountMinor, accountId);
                      setError(result.error);
                      return;
                    }
                    applyMovementsAdd({
                      id: result.id ?? crypto.randomUUID(),
                      description,
                      category: null,
                      transactionType: "expense",
                      direction: "debit",
                      amountMinor,
                      currency,
                      occurredAt: new Date().toISOString(),
                      source: "manual",
                    });
                    void warmupPlanPageData();
                  } finally {
                    guard.end();
                  }
                })();
              }}
            >
              Spara
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
