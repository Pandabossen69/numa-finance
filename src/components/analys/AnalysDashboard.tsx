"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { AnalysFailSoft, AnalysPending } from "@/components/layout/ViewLoading";
import { useNavIntent } from "@/components/layout/NavIntent";
import { DestinationWarmup, usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { FormulaInfo } from "@/components/analys/FormulaInfo";
import { PlanMonthNav } from "@/components/plan/PlanMonthNav";
import { buildAnalysMonth } from "@/features/finance/analys-month";
import {
  addMonthsKey,
  formatListDateSv,
  isInPayCycleWindow,
  monthKeyFromDate,
  labelMonthNameSv,
  labelMonthSv,
  spendingCategoriesInWindow,
  sumSpendingCategories,
  yearFromMonthKey,
  type SpendingCategoryTotal,
} from "@/domain/finance";
import {
  lastAnalysScope,
  lastAnalysSnapshot,
  lastMovementsView,
  lastPlanView,
  rememberMovementsView,
  rememberPlanView,
  subscribePlanView,
  rememberAnalysScope,
  rememberAnalysSnapshot,
} from "@/features/home/last-snapshot";
import {
  movementsViewForCategoryDrill,
  ovrigtDominatesSpend,
} from "@/components/analys/analys-category-drill";
import { senasteRowCategoryLabel } from "@/components/analys/senaste-row";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatDaysUntilSv } from "@/domain/finance";
import {
  formatMoneyCompact,
  humanizeMovementTitle,
  money,
  type CurrencyCode,
} from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
import { isThinAnalysSnapshot } from "@/features/finance/analys-from-known";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { AnalysSnapshot } from "@/features/finance/load-analys";

type AnalysScope = "period" | "month";

export function AnalysDashboard({
  data,
  error,
  retrying = false,
}: {
  data: AnalysSnapshot | null;
  error?: string | null;
  retrying?: boolean;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const { markIntent } = useNavIntent();
  const [scope, setScope] = useState<AnalysScope>(() => lastAnalysScope() ?? "period");
  // Share the month with Plan. Subscribed, not read once at mount, because
  // tabs stay mounted between visits.
  const sharedMonth = useSyncExternalStore(subscribePlanView, lastPlanView, () => null);
  if (data) rememberAnalysSnapshot(data);
  rememberAnalysScope(scope);
  const view = data ?? lastAnalysSnapshot() ?? ensurePaintableAnalysSnapshot();
  const activeMonthKey = sharedMonth?.monthKey ?? view?.currentMonthKey ?? null;

  // Same numbers as the server sends for today's month, recomputed locally for
  // any other month so browsing is instant and cannot drift from Plan.
  const month = useMemo(() => {
    if (!view || !activeMonthKey) return null;
    if (activeMonthKey === view.monthKey) return view.month;
    return buildAnalysMonth({
      planItems: view.planItems,
      spendingByMonthKey: view.spendingByMonthKey,
      ledgerTransactions: view.ledgerTransactions,
      saldoMinor: view.calculatedBalanceMinor,
      monthKey: activeMonthKey,
      currentMonthKey: view.currentMonthKey,
      timeZone: view.timeZone,
    });
  }, [activeMonthKey, view]);

  // "Senaste" belongs to what you are looking at: the browsed month in Månad,
  // the running pay cycle in Perioden.
  const recent = useMemo(() => {
    if (!view || !activeMonthKey) return [];
    const inScope = view.ledgerTransactions.filter((tx) => {
      if (tx.status !== "confirmed") return false;
      if (scope === "month") {
        return (
          monthKeyFromDate(new Date(tx.occurredAt), view.timeZone) === activeMonthKey
        );
      }
      return isInPayCycleWindow(tx.occurredAt, view.cycle.startAt, view.cycle.endAt);
    });
    return [...inScope]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8);
  }, [view, scope, activeMonthKey]);

  if (!view || !month || !activeMonthKey) {
    if (retrying) return <AnalysFailSoft error={error} retrying />;
    if (!error) return <AnalysPending />;
    return <AnalysFailSoft error={error} />;
  }

  const { currency, cycle } = view;
  const viewYear = yearFromMonthKey(activeMonthKey);

  function selectMonth(key: string) {
    rememberPlanView({ monthKey: key, viewYear: yearFromMonthKey(key) });
  }

  const monthCategories = view.categoriesByMonthKey[activeMonthKey] ?? [];
  const periodCategories = spendingCategoriesInWindow({
    transactions: view.ledgerTransactions,
    currency,
    startAt: cycle.startAt,
    endAt: cycle.endAt,
  });
  const listedCategories = scope === "month" ? monthCategories : periodCategories;
  const listedSpent = sumSpendingCategories(listedCategories);
  const thinFallback =
    isThinAnalysSnapshot(view) && listedSpent === 0
      ? scope === "month"
        ? view.monthSpendingMinor
        : view.cycleSpendingMinor
      : 0;
  // Hero Spenderat is the sum of the listed rows, so it cannot contradict
  // "Vart gick pengarna?" — Spec 4: Per kategori vs Spenderat must be one number.
  const spentMinor = listedSpent > 0 ? listedSpent : thinFallback;
  const categories =
    listedCategories.length > 0
      ? listedCategories
      : spentMinor > 0
        ? [{ name: "Spenderat", amountMinor: spentMinor, count: 1 }]
        : [];
  const previousMonthKey = addMonthsKey(activeMonthKey, -1);
  const previousSpentMinor = sumSpendingCategories(
    view.categoriesByMonthKey[previousMonthKey] ?? [],
  );
  const spendComparison =
    scope === "month" && spentMinor > 0 && previousSpentMinor > 0
      ? {
          deltaMinor: spentMinor - previousSpentMinor,
          monthName: labelMonthNameSv(previousMonthKey).toLocaleLowerCase("sv-SE"),
        }
      : null;

  const recentEmptyLabel =
    scope === "month"
      ? `Inga rörelser i ${labelMonthSv(activeMonthKey)}`
      : "Inga rörelser i perioden";

  const isBridge = cycle.livingMode === "bridge";
  const isEmpty = cycle.livingMode === "empty";
  const hasSaldo = view.hasBankTruth && view.calculatedBalanceMinor != null;
  const daysLeftLabel = formatDaysUntilSv(cycle.daysLeft);
  const cycleRangeLabel =
    cycle.startLabelSv && cycle.endLabelSv
      ? `${cycle.startLabelSv} – ${cycle.endLabelSv}`
      : null;
  const cycleTitle =
    cycleRangeLabel ??
    (isBridge && (cycle.nextIncomeLabelSv ?? cycle.startLabelSv)
      ? `${SV.tillNastaInkomst} · ${cycle.nextIncomeLabelSv ?? cycle.startLabelSv}`
      : "Ingen period ännu");
  const spentLabel = scope === "month" ? SV.spenderatIManaden : SV.spenderatIPerioden;
  const spentMeta =
    spendComparison == null
      ? null
      : spendComparison.deltaMinor === 0
        ? `Lika mycket som ${spendComparison.monthName}`
        : `${formatMoneyCompact(
            money(Math.abs(spendComparison.deltaMinor), currency),
          )} ${spendComparison.deltaMinor > 0 ? "mer" : "mindre"} än ${spendComparison.monthName}`;
  const categoryEmpty =
    scope === "month" ? SV.analysEmptySpendMonth : SV.analysEmptySpendPeriod;
  const periodGoingHint = [
    cycleRangeLabel,
    isBridge
      ? hasSaldo
        ? daysLeftLabel
        : "Ange saldo på Hem"
      : isEmpty
        ? SV.analysEmptyPeriod
        : cycle.isActive
          ? daysLeftLabel
          : SV.analysEmptyPeriod,
  ]
    .filter(Boolean)
    .join(" · ");
  const showPeriodKvar = !isEmpty && !(isBridge && !hasSaldo);
  const periodKvarMinor = isBridge && !hasSaldo ? 0 : cycle.remainingFreeMinor;

  return (
    <div className="numa-page numa-page-wide min-w-0 space-y-6 overflow-x-hidden pb-10">
      <DestinationWarmup hrefs={["/transaktioner", "/plan"]} />
      <header className="animate-rise flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="numa-page-title">Analys</h1>
          <p className="mt-1 max-w-[36ch] text-sm leading-snug text-[var(--numa-muted)]">
            {SV.analysHint}
          </p>
        </div>
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
          <SpendHero
            eyebrow={
              isBridge ? SV.tillNastaInkomst : isEmpty ? "Ingen period" : SV.perioden
            }
            title={cycleTitle}
            spentLabel={spentLabel}
            spentMinor={isEmpty ? 0 : spentMinor}
            currency={currency}
            meta={isEmpty ? SV.analysEmptyPeriod : daysLeftLabel}
          />

          {isEmpty ? (
            <section
              className="animate-rise-delay-2 space-y-2"
              aria-labelledby="analys-hur"
            >
              <h2 id="analys-hur" className="numa-section-title px-1">
                {SV.hurGarDet}
              </h2>
              <LeftoverVsPlanHint />
              <p className="px-1 text-sm leading-snug text-[var(--numa-muted)]">
                {SV.analysEmptyPeriod}{" "}
                <Link
                  href="/plan"
                  prefetch={false}
                  onMouseEnter={() => prefetch("/plan")}
                  onFocus={() => prefetch("/plan")}
                  className="numa-tap font-semibold text-[var(--numa-accent)]"
                >
                  Plan →
                </Link>
              </p>
            </section>
          ) : (
            <>
              <section
                className="animate-rise-delay-2 space-y-2"
                aria-labelledby="analys-hur"
              >
                <h2 id="analys-hur" className="numa-section-title px-1">
                  {SV.hurGarDet}
                </h2>
                <LeftoverVsPlanHint />
                {cycleRangeLabel ? (
                  <p className="px-1 text-sm leading-snug text-[var(--numa-muted)]">
                    {cycleRangeLabel}
                  </p>
                ) : null}
                <div className="numa-panel-list numa-money-stack px-4 py-1">
                  {showPeriodKvar ? (
                    <MetricRow
                      label={isBridge ? "Kvar tills nästa intäkt" : SV.kvarIPerioden}
                      amountMinor={periodKvarMinor}
                      currency={currency}
                      tone={periodKvarMinor >= 0 ? "positive" : "alarm"}
                      hint={periodGoingHint}
                    />
                  ) : (
                    <MetricRow
                      label={SV.kvarIPerioden}
                      hint={periodGoingHint}
                      value={<span className="text-sm text-[var(--numa-faint)]">—</span>}
                    />
                  )}
                </div>
              </section>

              <SpendByCategory
                categories={categories}
                currency={currency}
                empty={categoryEmpty}
                scope={scope}
                activeMonthKey={activeMonthKey}
                currentMonthKey={view.currentMonthKey}
              />
            </>
          )}
        </div>
      ) : (
        <section className="numa-scope-panel space-y-5">
          <PlanMonthNav
            monthKey={activeMonthKey}
            viewYear={viewYear}
            currentMonthKey={view.currentMonthKey}
            onSelectMonth={selectMonth}
            idPrefix="analys"
          />
          <SpendHero
            eyebrow={SV.manad}
            title={labelMonthSv(activeMonthKey)}
            spentLabel={spentLabel}
            spentMinor={spentMinor}
            currency={currency}
            meta={spentMeta}
          />

          <section className="space-y-2" aria-labelledby="analys-hur-manad">
            <h2 id="analys-hur-manad" className="numa-section-title px-1">
              {SV.hurGarDet}
            </h2>
            <LeftoverVsPlanHint />
            <div className="numa-panel-list numa-money-stack px-4 py-1">
              <MetricRow
                label={
                  month.monthResultMinor >= 0 ? SV.overskottHittills : SV.minusMotPlanen
                }
                amountMinor={month.monthResultMinor}
                currency={currency}
                tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}
                hint={month.monthLeftoverHint ?? undefined}
              />
            </div>
          </section>

          <SpendByCategory
            categories={categories}
            currency={currency}
            empty={categoryEmpty}
            scope={scope}
            activeMonthKey={activeMonthKey}
            currentMonthKey={view.currentMonthKey}
          />
        </section>
      )}

      <section className="animate-rise-delay-3 space-y-3">
        <p className="px-1 text-sm leading-snug text-[var(--numa-muted)]">
          {SV.analysPlanPointer}{" "}
          <Link
            href="/plan"
            prefetch={false}
            onMouseEnter={() => prefetch("/plan")}
            onFocus={() => prefetch("/plan")}
            className="numa-tap font-semibold text-[var(--numa-accent)]"
          >
            Plan →
          </Link>
        </p>
      </section>

      <section className="animate-rise-delay-3 space-y-3 pb-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Senaste</h2>
          <Link
            href="/transaktioner"
            prefetch={false}
            onPointerDown={() => {
              prefetch("/transaktioner");
              markIntent("/transaktioner");
            }}
            onMouseEnter={() => prefetch("/transaktioner")}
            onFocus={() => prefetch("/transaktioner")}
            onClick={() => markIntent("/transaktioner")}
            className="numa-tap text-xs font-semibold text-[var(--numa-accent)]"
          >
            Alla →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--numa-faint)]">{recentEmptyLabel}</p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {recent.map((tx) => {
              const signed = tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              const categoryLabel = senasteRowCategoryLabel(tx);
              return (
                <li
                  key={tx.id}
                  className="numa-money-line items-center px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
                >
                  <div className="numa-money-line-label">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {humanizeMovementTitle(tx.description, signed)}
                    </p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-[var(--numa-faint)]">
                      {categoryLabel ? (
                        <span className="truncate">{categoryLabel}</span>
                      ) : null}
                      <span className="shrink-0">
                        {formatListDateSv(tx.occurredAt, view.timeZone, {
                          withTime: true,
                        })}
                      </span>
                    </p>
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

/** Always-visible leftover one-liner — default Perioden paint, no extra tap. */
function LeftoverVsPlanHint() {
  return (
    <p className="px-1 text-[12px] leading-snug text-[var(--numa-faint)]">
      {SV.overskottMotPlanenHint}
    </p>
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

function SpendHero({
  eyebrow,
  title,
  spentLabel,
  spentMinor,
  currency,
  meta,
}: {
  eyebrow: string;
  title: string;
  spentLabel: string;
  spentMinor: number;
  currency: CurrencyCode;
  meta?: string | null;
}) {
  return (
    <section
      className="numa-panel-strong animate-rise-delay-1 space-y-3 p-5"
      aria-labelledby="analys-hero"
    >
      <p className="numa-section-title">{eyebrow}</p>
      <h2
        id="analys-hero"
        className="text-base font-semibold tracking-tight text-[var(--numa-ink)]"
      >
        {title}
      </h2>
      <p className="text-xs font-medium text-[var(--numa-faint)]">{spentLabel}</p>
      <div className="numa-hero-money text-[var(--numa-ink)]">
        <MoneyDisplay
          amountMinor={spentMinor}
          currency={currency}
          size="xl"
          wrap={false}
        />
      </div>
      {meta ? <p className="text-sm text-[var(--numa-muted)]">{meta}</p> : null}
    </section>
  );
}

/**
 * Where the money went. Same rows as the Spenderat hero, split by the
 * category saved on each transaction, biggest first. No second total.
 * Each row opens Rörelser with that category already selected.
 */
function SpendByCategory({
  categories,
  currency,
  empty,
  scope,
  activeMonthKey,
  currentMonthKey,
}: {
  categories: SpendingCategoryTotal[];
  currency: CurrencyCode;
  empty: string;
  scope: AnalysScope;
  activeMonthKey: string;
  currentMonthKey: string;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const { markIntent } = useNavIntent();
  const biggest = categories[0]?.amountMinor || 1;
  const showDrillHint = ovrigtDominatesSpend(categories);
  const openCategoryRef = useRef<(name: string) => void>(() => {});

  // NavIntent paints Rörelser on document capture pointerdown, which runs
  // before this link's own handler. Window capture runs first, so the
  // category is committed before the panel is revealed.
  useLayoutEffect(() => {
    function openCategory(name: string) {
      flushSync(() => {
        rememberMovementsView(
          movementsViewForCategoryDrill(name, {
            scope,
            activeMonthKey,
            currentMonthKey,
            existing: lastMovementsView(),
          }),
        );
      });
    }
    openCategoryRef.current = openCategory;
    function categoryFromEvent(event: Event): string | null {
      if (!(event.target instanceof Element)) return null;
      const link = event.target.closest("[data-analys-category]");
      if (!(link instanceof HTMLElement)) return null;
      return link.getAttribute("data-analys-category");
    }
    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const name = categoryFromEvent(event);
      if (!name) return;
      openCategory(name);
    }
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const name = categoryFromEvent(event);
      if (!name) return;
      openCategory(name);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [scope, activeMonthKey, currentMonthKey]);

  return (
    <section className="space-y-3" aria-label={SV.vartGickPengarna}>
      <div className="px-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
          {SV.vartGickPengarna}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{SV.analysCategoryHint}</p>
        {showDrillHint ? (
          <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
            {SV.analysCategoryDrillHint}
          </p>
        ) : null}
      </div>
      {categories.length === 0 ? (
        <p className="px-0.5 text-sm leading-snug text-[var(--numa-muted)]">{empty}</p>
      ) : (
        <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
          {categories.map((category) => (
            <li key={category.name}>
              <Link
                href="/transaktioner"
                prefetch={false}
                data-analys-category={category.name}
                aria-label={`Visa ${category.name}`}
                onPointerDown={() => {
                  openCategoryRef.current(category.name);
                  prefetch("/transaktioner");
                  markIntent("/transaktioner");
                }}
                onMouseEnter={() => prefetch("/transaktioner")}
                onFocus={() => prefetch("/transaktioner")}
                onClick={() => {
                  openCategoryRef.current(category.name);
                  markIntent("/transaktioner");
                }}
                className="numa-press block min-h-11 w-full px-4 py-3 text-left"
              >
                <div className="numa-money-line mb-1.5 text-sm">
                  <span className="numa-money-line-label text-[var(--numa-muted)]">
                    {category.name}
                    <span className="ml-2 text-xs text-[var(--numa-faint)]">
                      {category.count}×
                      <span className="ml-1.5" aria-hidden>
                        ›
                      </span>
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
