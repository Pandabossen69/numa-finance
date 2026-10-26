"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import { serverNull } from "@/lib/react/server-snapshot";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DayBudgetBar } from "@/components/home/DayDial";
import { ExtraSaldoRow } from "@/components/ui/ExtraSaldoRow";
import { Icon } from "@/components/ui/Icon";
import { InfoNote } from "@/components/ui/InfoNote";
import { TextLink } from "@/components/ui/TextLink";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { PileLine } from "@/components/ui/PileLine";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { BankMailHemCue } from "@/components/home/BankMailHemCue";
import {
  DAGSBUDGET_BILLS_EXCEED_SALDO_SV,
  PERIOD_ENDED_BODY_SV,
  PERIOD_ENDED_CTA_SV,
  PERIOD_ENDED_TITLE_SV,
  unpaidBillsExceedSaldo,
} from "@/features/home/dagsbudget-empty";
import { GettingStartedCard } from "@/components/home/GettingStartedCard";
import { warmupPlanPageData } from "@/components/plan/plan-cache";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";
import {
  formatDaysUntilSv,
  inferReservedSavingsMinor,
  labelMonthNameSv,
  labelSavingsMonthsSv,
  livingBudgetHintSv,
} from "@/domain/finance";
import {
  formatMoneyCompact,
  money,
  parseUiAmountToMinor,
  type CurrencyCode,
} from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
import { setAvailableNowAction } from "@/features/finance/actions";
import {
  lastQuickAddError,
  subscribeQuickAddError,
} from "@/features/finance/quick-add-optimistic";
import {
  bankMailPendingCountVersion,
  publishBankMailPendingCountIfCurrent,
} from "@/features/imports/bank-mail-queue-refresh";
import { readHomeSnapshot } from "@/lib/numa/read-client";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  financeTruthMessageSv,
  shouldShowFinanceTruthBanner,
} from "@/features/finance/finance-truth-copy";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  reconcileGettingStartedWithSaldo,
  type GettingStartedView,
} from "@/features/getting-started/progress";
import {
  adoptAccountsLastKnown,
  applyAccountBalance,
  isHomeDirty,
  lastGettingStarted,
  lastSessionHomeSnapshot,
  paintableAccountsSnapshot,
  rememberGettingStarted,
  rememberHomeSnapshot,
  subscribeGettingStarted,
  subscribeAccountsSnapshot,
  subscribeHomeSnapshot,
} from "@/features/home/last-snapshot";
import { homeGreeting } from "@/features/home/mock-snapshot";
import { lowKvarNextAction, type LowKvarCta } from "@/features/home/low-kvar-cta";
import { HemPending } from "@/components/layout/ViewLoading";

function formatMoneyHint(amountMinor: number, currency: CurrencyCode): string {
  const minor = Number.isFinite(amountMinor) ? Math.round(amountMinor) : 0;
  return formatMoneyCompact(money(minor, currency));
}

export function HomeDashboard({
  snap,
  error,
  accounts = null,
  gettingStarted = null,
  adoptSnap = true,
  knownPendingBankMailCount = null,
}: {
  snap: HomeSnapshot | null;
  error?: string | null;
  accounts?: AccountsSnapshot | null;
  gettingStarted?: GettingStartedView | null;
  /** When false, display snap without elevating it to session-confirmed (issue 107). */
  adoptSnap?: boolean;
  /** Last-known mail count from the same cookie shell as the saldo. */
  knownPendingBankMailCount?: number | null;
}) {
  const stored = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastSessionHomeSnapshot,
    () => null,
  );
  const accountsView = useSyncExternalStore(
    subscribeAccountsSnapshot,
    paintableAccountsSnapshot,
    serverNull,
  );
  const storedGettingStarted = useSyncExternalStore(
    subscribeGettingStarted,
    lastGettingStarted,
    serverNull,
  );
  const quickAddError = useSyncExternalStore(
    subscribeQuickAddError,
    lastQuickAddError,
    serverNull,
  );
  const sameOwner = !stored || !snap || stored.userId === snap.userId;
  // Prefer session-confirmed, then prop snap (incl. cookie SSR shell).
  const view = (sameOwner ? stored : null) ?? snap ?? lastSessionHomeSnapshot();

  useEffect(() => {
    // Adopt the server snap unless an optimistic spend is in flight.
    // Cookie/provisional shell must not confirm session (issue-107).
    // The old "== null" guard left Hem stuck on the first in-memory
    // snapshot (often 0) after saldo, Fota, or a later RSC load.
    if (adoptSnap && snap && !isHomeDirty()) rememberHomeSnapshot(snap);
    if (accounts) {
      adoptAccountsLastKnown(accounts);
    }
    if (gettingStarted && lastGettingStarted() == null) {
      rememberGettingStarted(gettingStarted);
    }
    if (snap?.calculatedBalanceMinor != null && lastGettingStarted()?.visible) {
      const next = reconcileGettingStartedWithSaldo(lastGettingStarted()!, true);
      if (next.doneCount !== lastGettingStarted()!.doneCount) {
        rememberGettingStarted(next);
      }
    }
    // Quiet NextStep-style warm: fill Plan/Analys/Rörelser last-known after
    // Hem paints. Idle + never clears on failure — not the old racing warmup.
    if (snap) scheduleQuietMenuWarm();
  }, [snap, accounts, gettingStarted, adoptSnap]);

  if (!view) {
    if (!error) return <HemPending />;
    const truth = financeTruthMessageSv({
      truthStatus: "unavailable",
      verifiedAt: null,
    });
    return (
      <div className="numa-panel-strong animate-rise space-y-3 p-5">
        <p className="text-sm font-semibold">{truth.title}</p>
        <p className="text-sm text-[var(--numa-muted)]">{error}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const staleBanner = shouldShowFinanceTruthBanner({
    truthStatus: view.truthStatus,
    error,
  })
    ? financeTruthMessageSv({
        truthStatus: view.truthStatus,
        verifiedAt: view.verifiedAt,
        timeZone: view.timeZone,
      })
    : null;

  const remainingTodayMinor = view.remainingTodayMinor;
  const todaySpendingMinor = view.todaySpendingMinor;
  const currency = view.currency;
  const greeting = homeGreeting(view.displayName, new Date(), view.timeZone);
  const isBridge = view.livingMode === "bridge";
  const isEmpty = view.livingMode === "empty";
  const periodEnded = !isEmpty && view.dayEnvelopeOpen === false;
  const dayEnvelopePending = !periodEnded && view.dayEnvelopePending === true;
  const hasSaldo = view.calculatedBalanceMinor != null;
  const rawGettingStarted = gettingStarted ?? storedGettingStarted;
  const checklist = rawGettingStarted?.visible
    ? reconcileGettingStartedWithSaldo(rawGettingStarted, hasSaldo)
    : rawGettingStarted;
  const dayOk = remainingTodayMinor > 0;
  const overToday = view.dayBudgetMinor > 0 && todaySpendingMinor > view.dayBudgetMinor;
  const dialCenterMinor = remainingTodayMinor;
  const rangeLabel =
    !periodEnded && !dayEnvelopePending && view.nextIncomeLabelSv
      ? `${SV.tillNastaInkomst} · ${view.nextIncomeLabelSv}`
      : null;

  const dayUsedRatio =
    view.dayBudgetMinor > 0 ? todaySpendingMinor / view.dayBudgetMinor : 0;
  const daysWord = formatDaysUntilSv(view.spendDaysLeft);

  const showDayEnvelope =
    !periodEnded &&
    !dayEnvelopePending &&
    (view.dayBudgetMinor > 0 || (view.livingPoolMinor ?? 0) > 0);
  const billsExceedSaldo = unpaidBillsExceedSaldo({
    hasSaldo,
    isEmpty,
    showDayEnvelope,
    unpaidMinor: view.unpaidMinor,
    balanceMinor: view.calculatedBalanceMinor,
  });

  const nextAction = lowKvarNextAction({
    dayBudgetMinor: view.dayBudgetMinor,
    remainingTodayMinor,
    livingMode: view.livingMode,
    needsAvailableInput: view.needsAvailableInput,
    hasPrimaryAccount: Boolean(view.primaryAccountId),
  });

  const heroIsDay = showDayEnvelope;
  const heroIsSaldo = hasSaldo && !showDayEnvelope && !dayEnvelopePending;
  const heroMinor = heroIsDay ? dialCenterMinor : view.calculatedBalanceMinor ?? 0;
  const heroTone =
    heroIsDay && (overToday || remainingTodayMinor < 0) ? "signed" : "neutral";
  const keyLine = !heroIsDay
    ? null
    : overToday
      ? SV.overDagsbudget
      : todaySpendingMinor === 0 && view.dayBudgetMinor > 0
        ? "Hela dagsbudgeten kvar"
        : `${formatMoneyHint(todaySpendingMinor, currency)} idag`;
  const budgetLines = heroIsDay
    ? livingBudgetHintSv({
        dayBudgetMinor: view.dayBudgetMinor,
        poolMinor: view.livingPoolMinor ?? view.calculatedBalanceMinor ?? 0,
        reservedMinor: view.reservedUntilIncomeMinor ?? 0,
        reservedSavingsMinor: inferReservedSavingsMinor({
          reservedMinor: view.reservedUntilIncomeMinor ?? 0,
          reservedSavingsMinor: view.reservedSavingsUntilIncomeMinor,
          planSavingsMinor: view.planSavingsMinor,
          savingsTotalMinor: view.savingsTotalMinor,
        }),
        reservedSavingsMonthKey: view.reservedSavingsMonthKey,
        savingsMonthLabelSv:
          labelSavingsMonthsSv(view.reservedSavingsMonthKey) ||
          labelMonthNameSv(view.monthKey),
        saldoMinor: view.calculatedBalanceMinor,
        spentTodayMinor: todaySpendingMinor,
        daysUntilHorizon: view.daysUntilIncome,
        nextIncomeLabelSv: view.nextIncomeLabelSv,
        currency,
      })
    : [];
  const savingsThisMonthMinor = view.planMonthSavingsMinor ?? view.planSavingsMinor;
  const savingsMonthName = labelMonthNameSv(view.monthKey);
  const savingsThisMonth = Math.max(0, savingsThisMonthMinor);
  const savingsPrior = Math.max(0, view.savingsTotalMinor - savingsThisMonth);
  const parkHeading =
    savingsThisMonth > 0 && savingsMonthName
      ? SV.sparaI(savingsMonthName)
      : savingsPrior > 0
        ? SV.sparat
        : SV.sparande;
  const parkAmount = savingsThisMonth > 0 ? savingsThisMonth : view.savingsTotalMinor;
  const showExtra =
    view.extraCarriedInMinor > 0 ||
    view.extraSaldoMinor > 0 ||
    view.extraSaldoDrawnMinor > 0 ||
    (!isBridge && view.cycleSpendingMinor > 0);

  return (
    <div className="numa-page numa-page-wide min-w-0 space-y-5">
      {quickAddError ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {quickAddError}
        </p>
      ) : null}
      {staleBanner && staleBanner.title ? (
        <div className="numa-panel animate-rise space-y-1 p-4 text-sm">
          <p className="font-semibold">{staleBanner.title}</p>
          {staleBanner.detail ? (
            <p className="text-[var(--numa-muted)]">{staleBanner.detail}</p>
          ) : null}
        </div>
      ) : null}
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
              Här syns läget just nu — saldo, det som kommer in och det som måste betalas.
            </p>
          </>
        ) : null}
      </header>
      <BankMailHemCue knownCount={knownPendingBankMailCount} />
      {isEmpty && checklist?.visible ? <GettingStartedCard view={checklist} /> : null}
      {view.needsAvailableInput ? (
        <AvailableNowCard
          accountId={view.primaryAccountId}
          currency={currency}
          nextIncomeLabel={view.nextIncomeLabelSv}
        />
      ) : null}
      {!view.needsAvailableInput ? (
        <>
          <section
            className={[
              "numa-panel-strong numa-day-stage animate-rise-delay-1 flex min-w-0 cursor-default flex-col space-y-3 px-4 py-4",
              overToday ? "is-over" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-labelledby="spend-heading"
          >
            <p id="spend-heading" className="numa-section-title min-w-0 px-1">
              {periodEnded
                ? PERIOD_ENDED_TITLE_SV
                : heroIsDay
                  ? SV.kvarIdag
                  : heroIsSaldo
                    ? SV.saldo
                    : SV.kvarIdag}
            </p>

            {dayEnvelopePending ? (
              <div className="space-y-3 py-2" aria-busy="true">
                <div className="numa-skel mx-auto h-10 w-40" />
                <div className="numa-skel h-1.5 w-full rounded-full" />
              </div>
            ) : heroIsDay ? (
              <>
                <div className="space-y-3 px-1">
                  {overToday ? (
                    <p className="numa-chip numa-chip-ink">Över</p>
                  ) : null}
                  <div
                    className={`money-hero ${
                      overToday || dayOk
                        ? "text-[var(--numa-ink)]"
                        : "text-[var(--numa-muted)]"
                    }`}
                  >
                    <MoneyDisplay
                      amountMinor={heroMinor}
                      currency={currency}
                      size="display"
                      compact
                      tone={heroTone}
                      wrap={false}
                    />
                  </div>
                  <DayBudgetBar usedRatio={dayUsedRatio} over={overToday} />
                  {keyLine ? (
                    <p className="flex min-h-5 min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] leading-snug text-[var(--numa-muted)]">
                      <span>{keyLine}</span>
                      {daysWord && keyLine !== "Hela dagsbudgeten kvar" ? (
                        <span className="text-[var(--numa-faint)]">{daysWord}</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {nextAction ? <LowKvarNextCta action={nextAction} /> : null}
                {view.todayPlannedPaidMinor > 0 ? (
                  <p className="px-1 text-[12px] text-[var(--numa-faint)]">
                    {SV.betaldaRakningarIdag}{" "}
                    <span className="font-semibold text-[var(--numa-ink)]">
                      {formatMoneyCompact(money(view.todayPlannedPaidMinor, currency))}
                    </span>
                  </p>
                ) : null}
                <details className="px-1">
                  <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-[var(--numa-muted)]">
                    Så räknas det
                  </summary>
                  <div className="numa-living-math pb-1">
                    {budgetLines.map((line, index) => (
                      <p
                        key={line}
                        className={
                          index === 0 ? "is-lead" : index === 2 ? "is-breakdown" : undefined
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <div className="space-y-3 px-1">
                {heroIsSaldo ? (
                  <div className="money-hero text-[var(--numa-ink)]">
                    <MoneyDisplay
                      amountMinor={heroMinor}
                      currency={currency}
                      size="display"
                      compact
                      tone="neutral"
                      wrap={false}
                    />
                  </div>
                ) : null}
                {periodEnded ? (
                  <>
                    <p className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                      {PERIOD_ENDED_BODY_SV}
                    </p>
                    <TextLink href="/plan?steg=inkomst">{PERIOD_ENDED_CTA_SV}</TextLink>
                  </>
                ) : isEmpty ? (
                  <>
                    <p className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                      {hasSaldo
                        ? "Ingen dagsbudget än. Lägg in vad som kommer in i Plan."
                        : "Ingen dagsbudget än. Sätt saldo så räknas kvar idag."}
                    </p>
                    <TextLink href={hasSaldo ? "/plan?steg=inkomst" : "/kom-igang"}>
                      {hasSaldo ? "Lägg in vad som kommer in" : "Sätt saldo"}
                    </TextLink>
                  </>
                ) : (
                  <>
                    <p className="max-w-[32ch] text-sm leading-relaxed text-[var(--numa-muted)]">
                      {billsExceedSaldo
                        ? DAGSBUDGET_BILLS_EXCEED_SALDO_SV
                        : isBridge
                          ? "Ange ditt saldo eller fota bank-SMS — då räknas dagsbudgeten."
                          : "När planen har pengar kvar syns dagsbudgeten här."}
                    </p>
                    {billsExceedSaldo ? (
                      <TextLink href="/plan">Betala senare i Plan</TextLink>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </section>

          <section
            className="animate-rise-delay-2 min-w-0"
            aria-label={SV.saldoOchSparande}
          >
            <div className="numa-panel-list px-4 py-1">
              {heroIsDay && hasSaldo ? (
                <PileLine
                  label={SV.saldo}
                  amountMinor={view.calculatedBalanceMinor}
                  currency={currency}
                />
              ) : null}
              <PileLine
                label={SV.kommerIn}
                amountMinor={view.incomingMinor}
                currency={currency}
                tone="in"
              />
              <PileLine
                label={SV.kvarAttBetala}
                amountMinor={view.unpaidMinor}
                currency={currency}
                tone="out"
              />
              {view.overMinor !== view.calculatedBalanceMinor ? (
                <PileLine
                  label={SV.over}
                  amountMinor={view.overMinor}
                  currency={currency}
                  tone={view.overMinor >= 0 ? "over" : "short"}
                />
              ) : null}
              <PileLine label={parkHeading} amountMinor={parkAmount} currency={currency} />
              {savingsThisMonth > 0 && savingsPrior > 0 ? (
                <p className="numa-pile-hint pb-1">
                  {SV.sparandeTotalt} {formatMoneyCompact(money(savingsPrior, currency))}
                </p>
              ) : null}
              <div className="flex justify-end">
                <InfoNote label="Om på kontona">{SV.saldoAllaKontonHint}</InfoNote>
              </div>
              {showExtra ? (
                <div className="border-t border-[var(--numa-border)]">
                  {view.extraCarriedInMinor > 0 ? (
                    <MetricRow
                      label={SV.extraMed}
                      amountMinor={view.extraCarriedInMinor}
                      currency={currency}
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
              {accountsView && accountsView.accounts.length > 0 ? (
                <Link
                  href="/konton"
                  className="numa-press flex min-h-11 items-center justify-between gap-3 border-t border-[var(--numa-border)] py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold tracking-tight">
                      {accountsView.accounts.length === 1
                        ? accountsView.accounts[0]!.name
                        : `${accountsView.accounts.length} konton`}
                    </span>
                  </span>
                  <Icon icon={ChevronRight} className="shrink-0 text-[var(--numa-faint)]" />
                </Link>
              ) : (
                <Link
                  href="/konton"
                  className="numa-press flex min-h-11 items-center justify-between gap-3 border-t border-[var(--numa-border)] py-2 text-[15px] font-semibold"
                >
                  Lägg till konto
                  <Icon icon={ChevronRight} className="shrink-0 text-[var(--numa-faint)]" />
                </Link>
              )}
            </div>
            {isBridge ? (
              <div className="px-1 text-sm">
                <UpdateBalanceLink
                  accountId={view.primaryAccountId}
                  currency={currency}
                />
              </div>
            ) : null}
          </section>
        </>
      ) : null}
      {!isEmpty && checklist?.visible ? <GettingStartedCard view={checklist} /> : null}
    </div>
  );
}

function LowKvarNextCta({ action }: { action: LowKvarCta }) {
  const className =
    "numa-btn numa-btn-primary numa-cta-glow numa-day-next min-h-12 w-full";
  return (
    <aside
      className="px-1 pt-1"
      aria-label={SV.nastaSteg}
      data-numa-next-action={action.kind}
    >
      <p className="mb-2 text-center text-[13px] leading-snug text-[var(--numa-muted)]">
        {action.hint}
      </p>
      {action.kind === "expense" ? (
        <a href={action.href} className={className}>
          {action.label}
        </a>
      ) : (
        <Link href={action.href} prefetch={false} className={className}>
          {action.label}
        </Link>
      )}
    </aside>
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
        <p className="numa-section-title">Saldo nu</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{SV.hurMycketKvar}</h2>
        <p className="mt-1 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Vi räknar ut en dagsbudget
          {nextIncomeLabel
            ? ` fram till nästa inkomst · ${nextIncomeLabel}`
            : " fram till nästa inkomst"}
          . När du handlar sjunker bara kvar idag.
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
              const seenCount = bankMailPendingCountVersion();
              void readHomeSnapshot().then((next) => {
                if (!next.ok) return;
                rememberHomeSnapshot(next.data);
                publishBankMailPendingCountIfCurrent(
                  seenCount,
                  next.pendingBankMailCount,
                );
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
              const seenCount = bankMailPendingCountVersion();
              void readHomeSnapshot().then((next) => {
                if (!next.ok) return;
                rememberHomeSnapshot(next.data);
                publishBankMailPendingCountIfCurrent(
                  seenCount,
                  next.pendingBankMailCount,
                );
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
