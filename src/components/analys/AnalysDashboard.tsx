"use client";

import { useState } from "react";
import Link from "next/link";
import { AnalysViewLoading } from "@/components/layout/ViewLoading";
import { FormulaInfo } from "@/components/analys/FormulaInfo";
import {
  lastAnalysScope,
  lastAnalysSnapshot,
  rememberAnalysScope,
  rememberAnalysSnapshot,
} from "@/features/home/last-snapshot";
import { ExtraSaldoRow } from "@/components/ui/ExtraSaldoRow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { WealthScoreboard } from "@/components/ui/WealthScoreboard";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { CompactMetricGrid, MetricRow } from "@/components/ui/MetricRow";
import { TxnLine } from "@/components/ui/TxnLine";
import { formatDaysUntilSv } from "@/domain/finance";
import { sanitizeMoneyDescription, type CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
import type { AnalysLine, AnalysSnapshot } from "@/features/finance/load-analys";

type AnalysScope = "period" | "month";

export function AnalysDashboard({
  data,
  error,
}: {
  data: AnalysSnapshot | null;
  error?: string | null;
}) {
  const [scope, setScope] = useState<AnalysScope>(() => lastAnalysScope() ?? "period");
  if (data) rememberAnalysSnapshot(data);
  rememberAnalysScope(scope);
  const view = data ?? lastAnalysSnapshot();

  if (!view) {
    if (!error) return <AnalysViewLoading />;
    return (
      <div className="numa-panel numa-error animate-rise space-y-3">
        <p className="text-sm font-semibold">Kunde inte ladda Analys</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const { currency, cycle, month } = view;
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
    <div className="numa-page numa-page-wide space-y-6">
      <header className="animate-rise flex flex-wrap items-start justify-between gap-3">
        <h1 className="numa-page-title">Analys</h1>
        <FormulaInfo steps={view.formula.steps} />
      </header>

      <div
        className="animate-rise-delay-1 flex gap-2"
        role="tablist"
        aria-label="Analysvy"
      >
        <ScopeChip
          id="analys-tab-period"
          controls="analys-panel-period"
          active={scope === "period"}
          onClick={() => setScope("period")}
          label={SV.perioden}
        />
        <ScopeChip
          id="analys-tab-month"
          controls="analys-panel-month"
          active={scope === "month"}
          onClick={() => setScope("month")}
          label={SV.manad}
        />
      </div>

      {scope === "period" ? (
        <div
          key="period"
          id="analys-panel-period"
          role="tabpanel"
          aria-labelledby="analys-tab-period"
          className="numa-scope-panel space-y-6"
        >
          <section
            className="numa-panel-strong numa-hero animate-rise-delay-1 space-y-3"
            aria-labelledby="analys-hero"
          >
            <p className="numa-section-title">{modeEyebrow}</p>
            {isBridge && !hasSaldo ? (
              <h2
                id="analys-hero"
                className="text-lg font-semibold tracking-tight text-[var(--numa-muted)]"
              >
                Ange saldo på Hem
              </h2>
            ) : (
              <div
                id="analys-hero"
                className={heroOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"}
              >
                <p className="sr-only">{heroLabel}</p>
                <MoneyDisplay
                  amountMinor={heroMinor}
                  currency={currency}
                  size="display"
                  align="start"
                />
              </div>
            )}
            {!(isBridge && !hasSaldo) ? (
              <p className="text-[15px] font-medium text-[var(--numa-muted)]">
                {heroMeta}
              </p>
            ) : (
              <p className="text-sm text-[var(--numa-muted)]">{heroMeta}</p>
            )}
            {cycleTitle !== "Ingen period ännu" ? (
              <p className="text-xs text-[var(--numa-faint)]">{cycleTitle}</p>
            ) : null}
          </section>

          {!isEmpty ? (
            <section className="animate-rise-delay-2 space-y-2">
              <p className="numa-section-title px-1">{SV.dagensEkonomi}</p>
              <CompactMetricGrid
                items={[
                  {
                    label: SV.kvarIdag,
                    amountMinor: isBridge && !hasSaldo ? 0 : cycle.remainingTodayMinor,
                    currency,
                    tone:
                      (!isBridge || hasSaldo) && cycle.remainingTodayMinor > 0
                        ? "positive"
                        : (!isBridge || hasSaldo) && cycle.remainingTodayMinor < 0
                          ? "alarm"
                          : undefined,
                  },
                  {
                    label: SV.dagsbudget,
                    amountMinor: isBridge && !hasSaldo ? 0 : cycle.dayBudgetMinor,
                    currency,
                  },
                  {
                    label: SV.spenderatIdag,
                    amountMinor: view.todaySpendingMinor,
                    currency,
                  },
                ]}
              />
            </section>
          ) : null}

          {!isEmpty && !(isBridge && hasSaldo) ? (
            <section
              className="animate-rise-delay-2 min-w-0 space-y-2"
              aria-label="Periodens siffror"
            >
              <div className="numa-panel-list px-4 py-1">
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
                  empty={
                    isBridge ? "Inga kommande intäkter." : "Inga intäkter i perioden."
                  }
                  lines={cycle.incomes}
                  currency={currency}
                  totalMinor={cycle.incomeMinor}
                  sign="income"
                />
                <LineList
                  title={isBridge ? "Kommande utgifter" : "Utgifter i perioden"}
                  subtitle={cycleRange}
                  empty={
                    isBridge ? "Inga kommande utgifter." : "Inga utgifter i perioden."
                  }
                  lines={cycle.expenses}
                  currency={currency}
                  totalMinor={cycle.expenseMinor}
                  sign="expense"
                />
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section
          id="analys-panel-month"
          role="tabpanel"
          aria-labelledby="analys-tab-month"
          className="numa-scope-panel space-y-5"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="numa-section-title">{SV.manad}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                {view.monthLabelSv}
              </h2>
            </div>
            <Link
              href="/plan"
              prefetch
              className="shrink-0 pb-0.5 text-xs font-semibold text-[var(--numa-accent)]"
            >
              Plan →
            </Link>
          </div>

          <WealthScoreboard
            livingMinor={month.livingSaldoMinor}
            livingLabel={SV.motPlanen}
            savingsMinor={month.savingsTotalMinor}
            totalMinor={month.wealthTotalMinor}
            currency={currency}
          />
          <p className="px-1 text-xs leading-snug text-[var(--numa-muted)]">
            Mot planen är inte kontanter — planerat kvar minus spenderat i månaden.
          </p>

          <div className="numa-panel-list px-4 py-1">
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
                currency={currency}
              />
            )}
            <MetricRow
              label={SV.spenderatIManaden}
              amountMinor={month.spentMinor}
              currency={currency}
            />
            <MetricRow
              label={
                month.monthResultMinor >= 0 ? SV.overskottHittills : SV.minusMotPlanen
              }
              amountMinor={month.monthResultMinor}
              currency={currency}
              tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}
            />
          </div>
          {monthSpendProgress != null ? (
            <div className="numa-progress animate-bar" aria-hidden>
              <span style={{ width: `${Math.max(8, monthSpendProgress * 100)}%` }} />
            </div>
          ) : null}

          <div className="grid items-start gap-4 md:grid-cols-2">
            <LineList
              title="Intäkter"
              subtitle={view.monthLabelSv}
              empty="Inga intäkter inlagda."
              lines={month.incomes}
              currency={currency}
              totalMinor={month.incomeMinor}
              sign="income"
            />
            <LineList
              title="Utgifter"
              subtitle={view.monthLabelSv}
              empty="Inga utgifter inlagda."
              lines={month.expenses}
              currency={currency}
              totalMinor={month.expenseMinor}
              sign="expense"
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
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Plan →
          </Link>
        </div>
        {view.goals.length === 0 ? (
          <p className="numa-panel numa-empty">
            Inga mål ännu. Lägg till ditt första sparmål från Plan.
          </p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {view.goals.map((goal) => (
              <li key={goal.id}>
                <TxnLine
                  title={goal.name}
                  amountMinor={goal.amountMinor}
                  currency={currency}
                  signed={false}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="animate-rise-delay-3 space-y-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Senaste</h2>
          <Link
            href="/transaktioner"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Alla →
          </Link>
        </div>
        {view.recent.length === 0 ? (
          <p className="numa-panel numa-empty">Inga rörelser ännu.</p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {view.recent.map((tx) => {
              const signed = tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              const category = tx.category?.trim() || null;
              const description = sanitizeMoneyDescription(tx.description);
              const title = category || description || "Rörelse";
              const meta =
                category && description && description !== category ? description : null;
              return (
                <li key={tx.id}>
                  <TxnLine
                    title={title}
                    meta={meta}
                    amountMinor={signed}
                    currency={tx.currency}
                  />
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
  id,
  controls,
  active,
  onClick,
  label,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`numa-press numa-scope-chip min-h-11 rounded-full px-4 text-sm font-semibold ${
        active
          ? "is-active bg-[var(--numa-ink)] text-white"
          : "bg-white text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
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
  totalMinor,
  sign,
}: {
  title: string;
  subtitle?: string;
  empty: string;
  lines: AnalysLine[];
  currency: CurrencyCode;
  totalMinor: number;
  sign: "income" | "expense";
}) {
  const signedTotal = sign === "expense" ? -Math.abs(totalMinor) : totalMinor;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="min-w-0 shrink-0">
          <MoneyDisplay
            amountMinor={signedTotal}
            currency={currency}
            size="md"
            compact
            align="end"
            wrap={false}
            tone="signed"
          />
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="numa-empty px-0.5">{empty}</p>
      ) : (
        <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
          {lines.map((line) => (
            <li key={line.id}>
              <TxnLine
                title={sanitizeMoneyDescription(line.name)}
                meta={sanitizeMoneyDescription(line.detail) || null}
                amountMinor={line.amountMinor}
                currency={currency}
                signed={false}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
