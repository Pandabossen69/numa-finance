"use client";

import { useState } from "react";
import Link from "next/link";
import { AnalysViewLoading } from "@/components/layout/ViewLoading";
import {
  DestinationWarmup,
  usePrefetchOnIntent,
} from "@/lib/nav/prefetch-intent";
import { FormulaInfo } from "@/components/analys/FormulaInfo";
import { PlanEquation } from "@/components/plan/PlanEquation";
import { PlanMonthNav } from "@/components/plan/PlanMonthNav";
import { buildAnalysMonth } from "@/features/finance/analys-month";
import {
  CASH_COVERAGE_HINT_SV,
  addMonthsKey,
  labelMonthNameSv,
  labelMonthSv,
  planWealthTotalMinor,
  visibleMonthKeysForYear,
  yearFromMonthKey,
  type SpendingCategoryTotal,
} from "@/domain/finance";
import { planChipClass, planChipLabel } from "@/components/plan/plan-chip";
import {
  lastAnalysScope,
  lastAnalysSnapshot,
  lastPlanView,
  rememberPlanView,
  rememberAnalysScope,
  rememberAnalysSnapshot,
} from "@/features/home/last-snapshot";
import { ExtraSaldoRow } from "@/components/ui/ExtraSaldoRow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { WealthScoreboard } from "@/components/ui/WealthScoreboard";
import { PileLine } from "@/components/ui/PileLine";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatDaysUntilSv } from "@/domain/finance";
import {
  formatMoneyCompact,
  humanizeMovementTitle,
  money,
  sanitizeMoneyDescription,
  type CurrencyCode,
} from "@/domain/money";
import { SV, type PlanSettleKind } from "@/features/copy/labels-sv";
import type { PlanListStatus } from "@/domain/finance";
import type { AnalysLine, AnalysSnapshot } from "@/features/finance/load-analys";

type AnalysScope = "period" | "month";

export function AnalysDashboard({
  data,
  error,
}: {
  data: AnalysSnapshot | null;
  error?: string | null;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const [scope, setScope] = useState<AnalysScope>(
    () => lastAnalysScope() ?? "period",
  );
  // Share the month with Plan, so switching tabs keeps you where you were.
  const [monthKey, setMonthKey] = useState<string | null>(
    () => lastPlanView()?.monthKey ?? null,
  );
  if (data) rememberAnalysSnapshot(data);
  rememberAnalysScope(scope);
  const view = data ?? lastAnalysSnapshot();

  if (!view) {
    if (!error) return <AnalysViewLoading />;
    return (
      <div className="numa-panel-strong animate-rise space-y-3 p-5">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const { currency, cycle } = view;
  const activeMonthKey = monthKey ?? view.currentMonthKey;
  const viewYear = yearFromMonthKey(activeMonthKey);
  // Same numbers as the server sends for today's month, recomputed locally for
  // any other month so browsing is instant and cannot drift from Plan.
  const month =
    activeMonthKey === view.monthKey
      ? view.month
      : buildAnalysMonth({
          planItems: view.planItems,
          spendingByMonthKey: view.spendingByMonthKey,
          ledgerTransactions: view.ledgerTransactions,
          saldoMinor: view.calculatedBalanceMinor,
          monthKey: activeMonthKey,
          currentMonthKey: view.currentMonthKey,
          timeZone: view.timeZone,
        });

  function selectMonth(key: string) {
    setMonthKey(key);
    rememberPlanView({ monthKey: key, viewYear: yearFromMonthKey(key) });
  }

  const monthCategories = view.categoriesByMonthKey[activeMonthKey] ?? [];
  // Total and comparison both come from the listed rows, so the header can
  // never contradict the categories under it.
  const categorySpentMinor = sumCategories(monthCategories);
  const previousMonthKey = addMonthsKey(activeMonthKey, -1);
  const previousSpentMinor = sumCategories(
    view.categoriesByMonthKey[previousMonthKey] ?? [],
  );
  const spendComparison =
    previousSpentMinor > 0
      ? {
          deltaMinor: categorySpentMinor - previousSpentMinor,
          monthName: labelMonthNameSv(previousMonthKey).toLocaleLowerCase("sv-SE"),
        }
      : null;

  function shiftYear(delta: number) {
    const nextYear = viewYear + delta;
    const keys = visibleMonthKeysForYear(nextYear);
    const preferred = `${nextYear}-${activeMonthKey.slice(5)}`;
    selectMonth(keys.includes(preferred) ? preferred : keys[0]!);
  }
  const isBridge = cycle.livingMode === "bridge";
  const isEmpty = cycle.livingMode === "empty";
  const isCycle = cycle.livingMode === "cycle";
  const hasSaldo = view.hasBankTruth && view.calculatedBalanceMinor != null;
  const heroMinor = isBridge && !hasSaldo ? 0 : cycle.remainingFreeMinor;
  const heroOk = hasSaldo || isCycle ? heroMinor >= 0 : false;
  const cycleTitle =
    isBridge && (cycle.nextIncomeLabelSv ?? cycle.startLabelSv)
      ? `Fram till ${cycle.nextIncomeLabelSv ?? cycle.startLabelSv}`
      : cycle.startLabelSv && cycle.endLabelSv
        ? `${cycle.startLabelSv} – ${cycle.endLabelSv}`
        : "Ingen period ännu";
  const daysLeftLabel = formatDaysUntilSv(cycle.daysLeft);
  const modeEyebrow = isBridge
    ? "Tills nästa intäkt"
    : isEmpty
      ? "Ingen period"
      : SV.perioden;
  const heroLabel = isBridge ? SV.saldo : SV.kvarIPerioden;
  const heroMeta = isBridge
    ? hasSaldo
      ? daysLeftLabel
      : "Ange saldo på Hem"
    : isEmpty
      ? "Lägg in intäkter i Plan"
      : cycle.isActive
        ? daysLeftLabel
        : "Lägg in intäkter i Plan";
  const cycleRange =
    cycle.startLabelSv && cycle.endLabelSv
      ? `${cycle.startLabelSv} – ${cycle.endLabelSv}`
      : undefined;

  const monthPool = month.freeToSpendMinor + month.extraCarriedInMinor;
  const monthSpendProgress =
    view.monthSpendingMinor > 0 && monthPool > 0
      ? Math.min(1, view.monthSpendingMinor / monthPool)
      : null;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6 pb-10">
      <DestinationWarmup hrefs={["/transaktioner", "/plan"]} />
      <header className="animate-rise flex flex-wrap items-start justify-between gap-3">
        <h1 className="numa-page-title">Analys</h1>
        <FormulaInfo steps={view.formula.steps} />
      </header>

      <div
        className="numa-equal-chips animate-rise-delay-1"
        role="tablist"
        aria-label="Analysvy"
      >
        <ScopeChip
          active={scope === "period"}
          onClick={() => setScope("period")}
          label={SV.perioden}
        />
        <ScopeChip
          active={scope === "month"}
          onClick={() => setScope("month")}
          label={SV.manad}
        />
      </div>

      {scope === "period" ? (
        <div key="period" className="numa-scope-panel space-y-6">
          <section
            className="numa-panel-strong animate-rise-delay-1 space-y-3 p-5"
            aria-labelledby="analys-hero"
          >
            <p className="numa-section-title">{modeEyebrow}</p>
            <h2
              id="analys-hero"
              className="text-base font-semibold tracking-tight text-[var(--numa-ink)]"
            >
              {cycleTitle}
            </h2>
            <p className="text-xs font-medium text-[var(--numa-faint)]">{heroLabel}</p>
            {isBridge && !hasSaldo ? (
              <p className="text-base font-medium text-[var(--numa-muted)]">
                Ange saldo på Hem
              </p>
            ) : (
              <div
                className={`numa-hero-money ${heroOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"}`}
              >
                <MoneyDisplay
                  amountMinor={heroMinor}
                  currency={currency}
                  size="xl"
                  wrap={false}
                />
              </div>
            )}
            {!(isBridge && !hasSaldo) ? (
              <p className="text-sm text-[var(--numa-muted)]">{heroMeta}</p>
            ) : null}
          </section>

          {!isEmpty ? (
            <section className="animate-rise-delay-2 space-y-2">
              <p className="numa-section-title px-1">{SV.idag}</p>
              <div className="numa-panel-list numa-money-stack px-4 py-1">
                <MetricRow
                  label={SV.kvarIdag}
                  amountMinor={isBridge && !hasSaldo ? 0 : cycle.remainingTodayMinor}
                  currency={currency}
                  tone={
                    isBridge && !hasSaldo
                      ? undefined
                      : cycle.remainingTodayMinor < 0
                        ? "alarm"
                        : cycle.remainingTodayMinor > 0
                          ? "positive"
                          : undefined
                  }
                />
                <MetricRow
                  label={SV.dagsbudget}
                  amountMinor={isBridge && !hasSaldo ? 0 : cycle.dayBudgetMinor}
                  currency={currency}
                />
                <MetricRow
                  label={SV.spenderatIdag}
                  amountMinor={view.todaySpendingMinor}
                  currency={currency}
                />
              </div>
            </section>
          ) : null}

          {!isEmpty ? (
            <section
              className="animate-rise-delay-2 min-w-0 space-y-2"
              aria-label="Periodens siffror"
            >
              <div className="numa-panel-list numa-money-stack px-4 py-1">
                {isBridge ? (
                  hasSaldo ? null : (
                    <MetricRow
                      label={SV.saldo}
                      value={<span className="text-sm text-[var(--numa-faint)]">—</span>}
                    />
                  )
                ) : isCycle ? (
                  <>
                    <MetricRow
                      label={SV.intakter}
                      amountMinor={cycle.incomeMinor}
                      currency={currency}
                      tone="positive"
                    />
                    <MetricRow
                      label={SV.utgifter}
                      amountMinor={cycle.expenseMinor}
                      currency={currency}
                    />
                    <MetricRow
                      label={SV.sparande}
                      amountMinor={cycle.savingsMinor}
                      currency={currency}
                    />
                    <MetricRow
                      label={SV.spenderatIPerioden}
                      amountMinor={view.cycleSpendingMinor}
                      currency={currency}
                    />
                  </>
                ) : null}
                {hasSaldo ? (
                  <MetricRow
                    label={SV.paKontot}
                    amountMinor={view.calculatedBalanceMinor!}
                    currency={currency}
                  />
                ) : isBridge ? null : (
                  <MetricRow label={SV.saldo} />
                )}
              </div>
            </section>
          ) : null}

          {!isEmpty ? (
            <section className="animate-rise-delay-2 space-y-4">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <LineList
                  title={isBridge ? "Kommande intäkter" : "Intäkter i perioden"}
                  subtitle={cycleRange}
                  empty={isBridge ? "Inga kommande." : "Inga i perioden."}
                  lines={cycle.incomes}
                  currency={currency}
                  settleKind="income"
                />
                <LineList
                  title={isBridge ? "Kommande utgifter" : "Utgifter i perioden"}
                  subtitle={cycleRange}
                  empty={isBridge ? "Inga kommande." : "Inga i perioden."}
                  lines={cycle.expenses}
                  currency={currency}
                  settleKind="expense"
                />
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="numa-scope-panel space-y-5">
          <PlanMonthNav
            monthKey={activeMonthKey}
            viewYear={viewYear}
            currentMonthKey={view.currentMonthKey}
            onSelectMonth={selectMonth}
            onShiftYear={shiftYear}
            idPrefix="analys"
          />
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="numa-section-title">{SV.manad}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                {labelMonthSv(activeMonthKey)}
              </h2>
            </div>
            <Link
              href="/plan"
              prefetch
              onMouseEnter={() => prefetch("/plan")}
              onFocus={() => prefetch("/plan")}
              className="numa-tap shrink-0 text-xs font-semibold text-[var(--numa-accent)]"
            >
              Plan →
            </Link>
          </div>

          {/* The same Över as Hem and Plan, for the month you are looking at. */}
          <div className="numa-analys-wealth">
            <WealthScoreboard
              livingMinor={month.coverage.overMinor}
              livingLabel={SV.over}
              savingsMinor={month.savingsTotalMinor}
              totalMinor={planWealthTotalMinor(
                month.coverage.overMinor,
                month.savingsTotalMinor,
              )}
              currency={currency}
            />
          </div>

          <div className="numa-panel-list px-4 py-1">
            <div className="numa-pile-stack">
              <PileLine
                label={SV.saldo}
                amountMinor={month.coverage.saldoMinor}
                currency={currency}
              />
              <PileLine
                label={SV.kommerIn}
                amountMinor={month.coverage.incomingMinor}
                currency={currency}
                tone="in"
              />
              <PileLine
                label={SV.kvarAttBetala}
                amountMinor={month.coverage.unpaidMinor}
                currency={currency}
                tone="out"
              />
              <PileLine
                label={SV.over}
                amountMinor={month.coverage.overMinor}
                currency={currency}
                tone={month.coverage.overMinor >= 0 ? "over" : "short"}
              />
            </div>
            <p className="numa-pile-hint mt-3 mb-3">
              {CASH_COVERAGE_HINT_SV}
              {month.coverage.saldoMinor == null ? ". Lägg in saldo på Hem." : ""}
            </p>
          </div>

          <div className="numa-panel-list numa-money-stack px-4 py-1">
            <MetricRow
              label={SV.intakter}
              amountMinor={month.incomeMinor}
              currency={currency}
              tone="positive"
            />
            <MetricRow
              label={SV.utgifter}
              amountMinor={month.expenseMinor}
              currency={currency}
            />
            <MetricRow
              label={SV.kvarIManadenPlan}
              amountMinor={month.freeToSpendMinor}
              currency={currency}
              tone={month.freeToSpendMinor >= 0 ? "positive" : "alarm"}
            />
            {month.extraCarriedInMinor > 0 ? (
              <MetricRow
                label={SV.extraMed}
                amountMinor={month.extraCarriedInMinor}
                currency={currency}
                tone="positive"
              />
            ) : (
              <ExtraSaldoRow
                extraSaldoMinor={month.extraSaldoMinor}
                drawnMinor={month.extraSaldoDrawnMinor}
                hint={month.extraSaldoHint}
                currency={currency}
              />
            )}
            <MetricRow
              label={SV.spenderatIManaden}
              amountMinor={month.spentMinor}
              currency={currency}
            />
            {/* The plan-vs-spend story, kept as one row so it cannot be
                mistaken for the cash answer above. */}
            <MetricRow
              label={month.monthResultMinor >= 0 ? SV.overskottHittills : SV.minusMotPlanen}
              amountMinor={month.monthResultMinor}
              currency={currency}
              tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}
              hint={
                month.monthLeftoverHint ??
                "Planerat kvar minus spenderat — inte kontanter"
              }
            />
          </div>
          {monthSpendProgress != null ? (
            <div className="numa-progress animate-bar" aria-hidden>
              <span style={{ width: `${Math.max(8, monthSpendProgress * 100)}%` }} />
            </div>
          ) : null}

          <SpendByCategory
            categories={monthCategories}
            spentMinor={categorySpentMinor}
            comparison={spendComparison}
            currency={currency}
          />

          <div className="grid items-start gap-4 md:grid-cols-2">
            <LineList
              title="Intäkter"
              subtitle={labelMonthSv(activeMonthKey)}
              empty="Inga intäkter inlagda."
              lines={month.incomes}
              currency={currency}
              settleKind="income"
            />
            <LineList
              title="Utgifter"
              subtitle={labelMonthSv(activeMonthKey)}
              empty="Inga utgifter inlagda."
              lines={month.expenses}
              currency={currency}
              settleKind="expense"
            />
          </div>
        </section>
      )}

      <section className="animate-rise-delay-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Mål</h2>
          <Link
            href="/plan"
            prefetch
            onMouseEnter={() => prefetch("/plan")}
            onFocus={() => prefetch("/plan")}
            className="numa-tap text-xs font-semibold text-[var(--numa-accent)]"
          >
            Plan →
          </Link>
        </div>
        {view.goals.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Inga mål ännu. Avsätt sparande under Plan.
          </p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {view.goals.map((goal) => (
              <li
                key={goal.id}
                className="numa-money-line px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
              >
                <span className="numa-money-line-label text-sm text-[var(--numa-muted)]">
                  {goal.name}
                </span>
                <span className="numa-money-line-amt flex flex-col items-end gap-1">
                  <MoneyDisplay
                    amountMinor={goal.amountMinor}
                    currency={currency}
                    size="sm"
                    wrap={false}
                  />
                  <PlanStatusChip status={goal.status} kind="expense" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="animate-rise-delay-3 space-y-3 pb-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Senaste</h2>
          <Link
            href="/transaktioner"
            prefetch
            onMouseEnter={() => prefetch("/transaktioner")}
            onFocus={() => prefetch("/transaktioner")}
            className="numa-tap text-xs font-semibold text-[var(--numa-accent)]"
          >
            Alla →
          </Link>
        </div>
        {view.recent.length === 0 ? (
          <p className="text-sm text-[var(--numa-faint)]">Inga rörelser ännu</p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {view.recent.map((tx) => {
              const signed = tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              return (
                <li
                  key={tx.id}
                  className="numa-money-line items-center px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
                >
                  <div className="numa-money-line-label">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {humanizeMovementTitle(tx.description, signed)}
                    </p>
                    {tx.category ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">
                        {tx.category}
                      </p>
                    ) : null}
                  </div>
                  <span className="numa-money-line-amt">
                    <MoneyDisplay
                      amountMinor={signed}
                      currency={tx.currency}
                      size="sm"
                      tone="signed"
                      wrap={false}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`numa-press numa-scope-chip min-h-11 rounded-full px-3 text-sm font-semibold ${
        active
          ? "is-active bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
          : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
      }`}
    >
      {label}
    </button>
  );
}

function LineList({
  title,
  subtitle,
  empty,
  lines,
  currency,
  settleKind,
}: {
  title: string;
  subtitle?: string;
  empty: string;
  lines: AnalysLine[];
  currency: CurrencyCode;
  settleKind: PlanSettleKind;
}) {
  // What is still left, the same sum Plan's card shows. A Betald row keeps
  // its figure and its chip but stops counting, exactly as it does on Plan.
  const totalMinor = lines.reduce((sum, line) => sum + line.remainingMinor, 0);

  return (
    <div className="min-w-0 space-y-2">
      <div className="numa-money-line px-0.5">
        <div className="numa-money-line-label">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="numa-money-line-amt text-[var(--numa-muted)]">
          <MoneyDisplay
            amountMinor={totalMinor}
            currency={currency}
            size="sm"
            wrap={false}
          />
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="px-0.5 text-sm text-[var(--numa-faint)]">{empty}</p>
      ) : (
        <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
          {lines.map((line) => (
            <li
              key={line.id}
              className="numa-money-line items-center px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
            >
              <div className="numa-money-line-label">
                <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                  {sanitizeMoneyDescription(line.name)}
                </p>
                {line.status === "partial" ? (
                  <PlanEquation
                    breakdown={{
                      totalMinor: line.plannedMinor,
                      settledMinor: line.settledMinor,
                      remainingMinor: line.amountMinor,
                    }}
                  />
                ) : (
                  <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">
                    {sanitizeMoneyDescription(line.detail)}
                  </p>
                )}
              </div>
              <span className="numa-money-line-amt flex flex-col items-end gap-1">
                <MoneyDisplay
                  amountMinor={line.amountMinor}
                  currency={currency}
                  size="sm"
                  wrap={false}
                />
                <PlanStatusChip status={line.status} kind={settleKind} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Display-only twin of the Plan chip: same words, same colour, no action. */
function PlanStatusChip({
  status,
  kind,
}: {
  status: PlanListStatus;
  kind: PlanSettleKind;
}) {
  const label = planChipLabel(status, kind);
  if (!label) return null;
  return <span className={planChipClass(status)}>{label}</span>;
}

function sumCategories(categories: SpendingCategoryTotal[]): number {
  return categories.reduce((total, category) => total + category.amountMinor, 0);
}

/**
 * Where the month's money went. Same rows as Spenderat i månaden, split by
 * the category saved on each transaction, biggest first.
 */
function SpendByCategory({
  categories,
  spentMinor,
  comparison,
  currency,
}: {
  categories: SpendingCategoryTotal[];
  spentMinor: number;
  comparison: { deltaMinor: number; monthName: string } | null;
  currency: CurrencyCode;
}) {
  if (categories.length === 0) return null;
  const biggest = categories[0]?.amountMinor || 1;

  return (
    <section className="space-y-3" aria-label="Per kategori">
      <div className="numa-money-line px-0.5">
        <div className="numa-money-line-label">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
            Per kategori
          </h3>
          {comparison ? (
            <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">
              {comparison.deltaMinor === 0
                ? `Lika mycket som ${comparison.monthName}`
                : `${formatMoneyCompact(
                    money(Math.abs(comparison.deltaMinor), currency),
                  )} ${comparison.deltaMinor > 0 ? "mer" : "mindre"} än ${comparison.monthName}`}
            </p>
          ) : null}
        </div>
        <div className="numa-money-line-amt text-[var(--numa-muted)]">
          <MoneyDisplay
            amountMinor={spentMinor}
            currency={currency}
            size="sm"
            wrap={false}
          />
        </div>
      </div>
      <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
        {categories.map((category) => (
          <li key={category.name} className="px-4 py-3">
            <div className="numa-money-line mb-1.5 text-sm">
              <span className="numa-money-line-label text-[var(--numa-muted)]">
                {category.name}
                <span className="ml-2 text-xs text-[var(--numa-faint)]">
                  {category.count}×
                </span>
              </span>
              <span className="numa-money-line-amt">
                <MoneyDisplay
                  amountMinor={category.amountMinor}
                  currency={currency}
                  size="sm"
                  wrap={false}
                />
              </span>
            </div>
            <div className="numa-progress animate-bar" aria-hidden>
              <span
                style={{
                  width: `${Math.max(6, (category.amountMinor / biggest) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
