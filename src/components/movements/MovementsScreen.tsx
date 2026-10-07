"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { MovementsViewLoading } from "@/components/movements/MovementsViewLoading";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { PlanDateField } from "@/components/plan/PlanDateField";
import { usesAlarmColor } from "@/components/ui/amount-tone";
import {
  updateTransactionAction,
  voidTransactionAction,
} from "@/features/finance/actions";
import { invalidateAfterPlanLinkedVoid } from "@/features/finance/movement-void-plan";
import { serverNull } from "@/lib/react/server-snapshot";
import {
  formatListDateSv,
  isoToDateInput,
  occurredAtForBookedDay,
} from "@/domain/finance";
import { minorToUiAmount } from "@/domain/imports/amount-parse";
import { parseUiAmountToMinor, sanitizeMoneyDescription } from "@/domain/money";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import {
  mergeMovementNativeFromServer,
  movementEditPrefill,
} from "@/features/finance/movement-native";
import {
  adoptMutationFinance,
  applyMovementsEdit,
  applyMovementsVoid,
  captureOptimisticBalance,
  undoOptimisticBalance,
  isMovementsDirty,
  isStaleMovementsSnapshot,
  lastAccountsSnapshot,
  lastAnalysSnapshot,
  lastMovementsSnapshot,
  lastMovementsView,
  lastPlanSnapshot,
  rememberMovementsSnapshot,
  rememberMovementsView,
  subscribeAnalysSnapshot,
  subscribeMovementsSnapshot,
  subscribeMovementsView,
  subscribePlanSnapshot,
  type MovementsFilter,
  type MovementsPeriod,
  type MovementsView,
} from "@/features/home/last-snapshot";
import {
  clearMovementsDrill,
  lastMovementsDrill,
  rememberMovementsDrillFromHref,
  subscribeMovementsDrill,
  type MovementsDrill,
} from "./movements-drill";
import { drillSummaryFromRows } from "./drill-summary";
import { savedViewWithoutDrillFilters } from "./saved-view-drill";
import { useNavIntent } from "@/components/layout/NavIntent";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { spaTabKey } from "@/lib/nav/spa-tabs";
import { spendCategoryName, toggleCategory } from "./movements-category";
import {
  cycleWindowTotals,
  movementVisibleInRorelser,
  payCycleRangeLabelSv,
  resolveMovementsPayCycle,
} from "./movements-window";
import {
  MOVEMENTS_EMPTY_FILTER,
  MOVEMENTS_EMPTY_LEDGER,
  movementsEmptyKind,
} from "./movements-empty";

type Filter = MovementsFilter;
type Period = MovementsPeriod;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Alla" },
  { id: "expense", label: "Utgifter" },
  { id: "income", label: "Intäkter" },
  { id: "other", label: "Annat" },
];

function typeLabel(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Överföring";
    case "cash_withdrawal":
      return "Kontantuttag";
    case "refund":
      return "Återbetalning";
    default:
      return "Övrigt";
  }
}

function minorToUi(amountMinor: number): string {
  return minorToUiAmount(amountMinor);
}

export function MovementsScreen({
  data,
  error,
}: {
  data: MovementsSnapshot | null;
  error?: string | null;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const { pathname } = useNavIntent();
  const pathRef = useRef(pathname);
  const stored = useSyncExternalStore(
    subscribeMovementsSnapshot,
    lastMovementsSnapshot,
    serverNull,
  );
  const savedView = useSyncExternalStore(
    subscribeMovementsView,
    lastMovementsView,
    serverNull,
  );
  const filter = savedView?.filter ?? "all";
  const period = savedView?.period ?? "month";
  const category = savedView?.category ?? null;
  const cycleStartAt = savedView?.cycleStartAt ?? null;
  const cycleEndAt = savedView?.cycleEndAt ?? null;
  const planSnap = useSyncExternalStore(
    subscribePlanSnapshot,
    lastPlanSnapshot,
    () => null,
  );
  const analysLive = useSyncExternalStore(
    subscribeAnalysSnapshot,
    lastAnalysSnapshot,
    serverNull,
  );
  const drill = useSyncExternalStore(
    subscribeMovementsDrill,
    lastMovementsDrill,
    () => null,
  );
  const drillBaselineRef = useRef<{
    filter: Filter;
    category: string | null;
    drill: MovementsDrill;
  } | null>(null);
  const drillTouchedRef = useRef({ filter: false, category: false });
  const listRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "void" | null>(null);
  const actionLock = useRef(false);

  useEffect(() => {
    if (!confirmId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmId]);

  function publishView(partial: Partial<MovementsView>) {
    rememberMovementsView({
      filter,
      period,
      category,
      cycleStartAt,
      cycleEndAt,
      ...partial,
    });
  }

  // Hard load of a drill URL. SPA taps commit the same store in NavIntent
  // before the parked panel is revealed. A href without drill params clears it.
  useLayoutEffect(() => {
    rememberMovementsDrillFromHref(
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useLayoutEffect(() => {
    const prev = pathRef.current;
    pathRef.current = pathname;
    if (
      spaTabKey(prev) === "/transaktioner" &&
      spaTabKey(pathname) !== "/transaktioner" &&
      lastMovementsView()?.category
    ) {
      rememberMovementsView({
        filter: lastMovementsView()?.filter ?? "all",
        period: lastMovementsView()?.period ?? "month",
        category: null,
        cycleStartAt: lastMovementsView()?.cycleStartAt ?? null,
        cycleEndAt: lastMovementsView()?.cycleEndAt ?? null,
      });
    }
  }, [pathname]);

  // Drill chips are an overlay. If Utgifter or the category were written
  // into the saved view, put back what the user had before the drill.
  // A chip they tap themselves is kept (drillTouchedRef).
  useLayoutEffect(() => {
    if (drill) {
      if (!drillBaselineRef.current) {
        const saved = lastMovementsView();
        drillBaselineRef.current = {
          filter: saved?.filter ?? "all",
          category: saved?.category ?? null,
          drill,
        };
        drillTouchedRef.current = { filter: false, category: false };
      } else {
        drillBaselineRef.current = { ...drillBaselineRef.current, drill };
      }
      return;
    }
    const baseline = drillBaselineRef.current;
    if (!baseline) return;
    drillBaselineRef.current = null;
    const touched = drillTouchedRef.current;
    drillTouchedRef.current = { filter: false, category: false };
    const current = lastMovementsView();
    if (!current) return;
    const restored = savedViewWithoutDrillFilters({
      before: { filter: baseline.filter, category: baseline.category },
      current,
      drill: baseline.drill,
    });
    const next = {
      ...restored,
      filter: touched.filter ? current.filter : restored.filter,
      category: touched.category ? (current.category ?? null) : restored.category,
    };
    if (
      next.filter === current.filter &&
      (next.category ?? null) === (current.category ?? null)
    ) {
      return;
    }
    rememberMovementsView(next);
  }, [drill]);

  useEffect(() => {
    if (!data) return;
    // `data` is the store snapshot on the client-first route. Merging it
    // with itself used to allocate, emit, and re-enter this effect.
    if (data === lastMovementsSnapshot()) return;
    const current = lastMovementsSnapshot();
    // Older than the optimistic paint — keep the edited amount / temp row.
    if (current != null && isStaleMovementsSnapshot(data)) return;
    if (current == null || !isMovementsDirty()) {
      rememberMovementsSnapshot(data);
      return;
    }
    // Server native fields are adopted — drop the dirty lock. Keeping it
    // made the next emit look like another server snapshot.
    rememberMovementsSnapshot(mergeMovementNativeFromServer(current, data));
  }, [data]);

  // null = unknown (skeleton). A snapshot with items: [] is a real empty list.
  const view = stored ?? data ?? null;

  // Drill is an overlay. The chips above stay the user's saved view and
  // are the only thing rememberMovementsView persists.
  const viewPeriod = drill?.period ?? period;
  const viewFilter = drill?.filter ?? filter;
  const viewCategory = drill?.category ?? category;
  const liveCycle = view
    ? resolveMovementsPayCycle({
        planItems: planSnap?.items,
        timeZone: view.timeZone,
        now: new Date(),
        analysStartAt: analysLive?.cycle.startAt,
        analysEndAt: analysLive?.cycle.endAt,
        snapshotStartAt: view.payCycleStartAt,
        snapshotEndAt: view.payCycleEndAt,
      })
    : null;
  // Drill still filters via the URL. The Perioden chip uses the live pay
  // cycle and is not written back into the saved view.
  const viewCycleStart = drill
    ? drill.from
    : viewPeriod === "cycle"
      ? (liveCycle?.startAt ?? cycleStartAt)
      : cycleStartAt;
  const viewCycleEnd = drill
    ? drill.to
    : viewPeriod === "cycle"
      ? (liveCycle?.endAt ?? cycleEndAt)
      : cycleEndAt;

  const filtered = view
    ? view.items.filter((tx) =>
        movementVisibleInRorelser(tx, {
          filter: viewFilter,
          period: viewPeriod,
          category: viewCategory,
          monthKey: view.monthKey,
          timeZone: view.timeZone,
          cycleStartAt: viewCycleStart,
          cycleEndAt: viewCycleEnd,
        }),
      )
    : [];

  function dropDrillOverlay() {
    if (!lastMovementsDrill()) return;
    clearMovementsDrill();
    if (typeof window === "undefined" || !window.location.search) return;
    const path = window.location.pathname;
    try {
      window.history.replaceState({ numaSpa: true, href: path }, "", path);
    } catch {
      // ignore
    }
  }

  function choosePeriod(next: Period) {
    dropDrillOverlay();
    publishView({ period: next });
  }

  function chooseFilter(next: Filter) {
    drillTouchedRef.current.filter = true;
    dropDrillOverlay();
    publishView({ filter: next });
  }

  function selectCategory(name: string) {
    drillTouchedRef.current.category = true;
    dropDrillOverlay();
    const next = toggleCategory(category, name);
    publishView({ category: next });
    if (next) {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!view) {
    if (!error) return <MovementsViewLoading />;
    return (
      <div className="space-y-2">
        <p className="font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const cycleTotals =
    viewPeriod === "cycle"
      ? cycleWindowTotals(view.items, viewCycleStart, viewCycleEnd)
      : null;
  const income = cycleTotals
    ? cycleTotals.incomeMinor
    : viewPeriod === "month"
      ? view.monthIncomeMinor
      : view.allIncomeMinor;
  const expense = cycleTotals
    ? cycleTotals.expenseMinor
    : viewPeriod === "month"
      ? view.monthExpenseMinor
      : view.allExpenseMinor;
  const net = cycleTotals
    ? cycleTotals.netMinor
    : viewPeriod === "month"
      ? view.monthNetMinor
      : view.allNetMinor;
  const drillSummary = drill
    ? drillSummaryFromRows(filtered, {
        category: viewCategory ?? "",
        period: viewPeriod,
        filter: viewFilter,
      })
    : null;
  const cycleRange = payCycleRangeLabelSv(
    liveCycle?.startAt,
    liveCycle?.endAt,
    view.timeZone,
  );
  const showCycleChip = cycleRange != null || viewPeriod === "cycle";
  const maxCategory = view.monthCategories[0]?.amountMinor || 1;

  return (
    <div className="numa-page numa-page-wide min-w-0 space-y-7 overflow-x-hidden">
      <header className="animate-rise">
        <h1 className="numa-page-title">Rörelser</h1>
      </header>

      <div className="numa-equal-chips animate-rise-delay-1">
        <PeriodChip
          active={viewPeriod === "month"}
          onClick={() => choosePeriod("month")}
          label="Denna månad"
        />
        <PeriodChip
          active={viewPeriod === "all"}
          onClick={() => choosePeriod("all")}
          label="All tid"
        />
        {showCycleChip ? (
          <PeriodChip
            active={viewPeriod === "cycle"}
            onClick={() => choosePeriod("cycle")}
            label="Perioden"
            detail={cycleRange}
            className="col-span-2"
          />
        ) : null}
      </div>

      {drillSummary?.expenseOnly ? (
        <section
          data-drill-summary=""
          className="numa-panel-strong animate-rise-delay-1 min-w-0 p-5"
          aria-label={`${drillSummary.label}, ${drillSummary.count} st`}
        >
          <p className="numa-section-title break-words">{drillSummary.label}</p>
          <div className="numa-hero-money mt-2 text-[var(--numa-ink)]">
            <MoneyDisplay
              amountMinor={drillSummary.amountMinor}
              currency={view.currency}
              size="md"
              wrap={false}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-[var(--numa-faint)]">
            {drillSummary.count} st
          </p>
        </section>
      ) : (
        <section className="numa-panel-strong numa-stat-trio animate-rise-delay-1 p-5">
          <SummaryStat
            label="Intäkter"
            amountMinor={income}
            currency={view.currency}
            tone="positive"
          />
          <SummaryStat
            label="Utgifter"
            amountMinor={expense}
            currency={view.currency}
            tone="neutral"
          />
          <SummaryStat
            label="Netto"
            amountMinor={net}
            currency={view.currency}
            tone={net >= 0 ? "positive" : "alarm"}
            signed
          />
        </section>
      )}

      {view.hasBankTruth && view.balanceMinor != null ? (
        <section className="numa-money-stack animate-rise-delay-2 animate-scale-in">
          <MetricRow
            label="På kontona"
            amountMinor={view.balanceMinor}
            currency={view.currency}
            tone={usesAlarmColor(view.balanceMinor) ? "alarm" : undefined}
          />
        </section>
      ) : null}

      {viewPeriod === "month" && view.monthCategories.length > 0 ? (
        <section className="numa-panel animate-rise-delay-2 p-5">
          <h2 className="numa-section-title">Per kategori</h2>
          <p className="mt-1 text-xs leading-snug text-[var(--numa-faint)]">
            {viewCategory
              ? `Visar ${viewCategory}. Tryck igen för att visa alla.`
              : "Tryck på en kategori för att filtrera listan."}
          </p>
          <ul className="mt-4 space-y-2">
            {view.monthCategories.map((cat) => {
              const selected = viewCategory === cat.name;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? `Visa alla kategorier` : `Visa ${cat.name}`}
                    onClick={() => selectCategory(cat.name)}
                    className={`numa-press min-h-11 w-full min-w-0 rounded-2xl px-2.5 py-2 text-left ${
                      selected
                        ? "is-active bg-[var(--numa-bg)] ring-2 ring-[var(--numa-ink)]"
                        : "ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-bg)]/55"
                    }`}
                  >
                    <div className="numa-money-line mb-1.5 text-sm">
                      <span
                        className={`numa-money-line-label ${
                          selected
                            ? "font-semibold text-[var(--numa-ink)]"
                            : "text-[var(--numa-muted)]"
                        }`}
                      >
                        {cat.name}
                        <span className="ml-2 text-xs font-medium text-[var(--numa-faint)]">
                          {cat.count}×
                        </span>
                      </span>
                      <span className="numa-money-line-amt">
                        <MoneyDisplay
                          amountMinor={cat.amountMinor}
                          currency={view.currency}
                          size="sm"
                          wrap={false}
                        />
                      </span>
                    </div>
                    <div className="numa-progress animate-bar">
                      <span
                        style={{
                          width: `${Math.max(6, (cat.amountMinor / maxCategory) * 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="numa-equal-chips is-quad animate-rise-delay-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => chooseFilter(f.id)}
            className={`numa-press min-h-11 rounded-full px-3 text-sm font-semibold ${
              viewFilter === f.id
                ? "bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
                : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section ref={listRef} className="animate-rise-delay-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-sm font-semibold">
            {filtered.length} {filtered.length === 1 ? "rörelse" : "rörelser"}
            {viewCategory ? (
              <span className="font-medium text-[var(--numa-muted)]">
                {" "}
                · {viewCategory}
              </span>
            ) : null}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {viewCategory ? (
              <button
                type="button"
                onClick={() => {
                  drillTouchedRef.current.category = true;
                  dropDrillOverlay();
                  publishView({ category: null });
                }}
                className="numa-press numa-category-chip is-active min-h-11 max-w-[12ch] truncate rounded-full bg-[var(--numa-ink)] px-3 text-xs font-semibold text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
                aria-label="Visa alla kategorier"
              >
                {viewCategory}
              </button>
            ) : null}
            <Link
              href="/fota"
              prefetch
              onMouseEnter={() => prefetch("/fota")}
              onFocus={() => prefetch("/fota")}
              className="numa-tap text-xs font-semibold text-[var(--numa-accent)]"
            >
              + Lägg till
            </Link>
          </div>
        </div>

        {actionError ? (
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {actionError}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="numa-panel space-y-3 p-5">
            {movementsEmptyKind({
              itemCount: view.items.length,
              filter: viewFilter,
              period: viewPeriod,
              category: viewCategory,
            }) === "filter" ? (
              <p className="text-sm text-[var(--numa-muted)]">{MOVEMENTS_EMPTY_FILTER}</p>
            ) : (
              <>
                <p className="text-sm text-[var(--numa-muted)]">
                  {MOVEMENTS_EMPTY_LEDGER}
                </p>
                {view.items.length === 0 ? (
                  <Link
                    href="/fota"
                    prefetch
                    onMouseEnter={() => prefetch("/fota")}
                    onFocus={() => prefetch("/fota")}
                    className="numa-btn numa-btn-accent inline-flex min-h-11 px-4"
                  >
                    Lägg till
                  </Link>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {filtered.map((tx) => {
              const signed = tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              const canEdit =
                tx.transactionType === "expense" || tx.transactionType === "income";

              if (editingId === tx.id) {
                const accountCurrency = lastAccountsSnapshot()?.accounts.find(
                  (account) => account.id === tx.accountId,
                )?.currency;
                const editPrefill = movementEditPrefill(tx, accountCurrency);
                return (
                  <li key={tx.listKey ?? tx.id} className="space-y-3 px-4 py-3.5">
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Beskrivning"
                      className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
                    />
                    <label className="relative block">
                      <input
                        inputMode="decimal"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        aria-label={`Belopp ${editPrefill.currency}`}
                        className="money min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 pr-12 text-lg font-semibold"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[var(--numa-muted)]">
                        {editPrefill.currency}
                      </span>
                    </label>
                    {tx.transactionType === "expense" ? (
                      <input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Kategori"
                        className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
                      />
                    ) : null}
                    <PlanDateField
                      ariaLabel="Datum"
                      value={editDate}
                      max={
                        isoToDateInput(new Date().toISOString(), view.timeZone) ||
                        editDate
                      }
                      onChange={setEditDate}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pendingAction != null}
                        className="numa-btn numa-btn-accent flex-1"
                        onClick={() => {
                          if (actionLock.current || pendingAction) return;
                          let amountMinor: number;
                          let description: string;
                          try {
                            amountMinor = parseUiAmountToMinor(editAmount);
                            description = sanitizeMoneyDescription(editDescription);
                          } catch {
                            setActionError("Ogiltigt belopp");
                            return;
                          }
                          if (amountMinor <= 0) {
                            setActionError("Beloppet måste vara större än 0");
                            return;
                          }
                          const previous = {
                            amountMinor: tx.amountMinor,
                            nativeAmountMinor: tx.nativeAmountMinor ?? tx.amountMinor,
                            thbMinor: tx.amountMinor,
                            description: tx.description,
                            category: tx.category,
                            occurredAt: tx.occurredAt,
                          };
                          const nextCategory =
                            tx.transactionType === "expense"
                              ? editCategory || null
                              : undefined;
                          const occurredAt = occurredAtForBookedDay({
                            ymd: editDate,
                            timeZone: view.timeZone,
                            keepTimeFrom: tx.occurredAt,
                          });
                          actionLock.current = true;
                          setPendingAction("save");
                          setActionError(null);
                          setEditingId(null);
                          applyMovementsEdit(tx.id, {
                            amountMinor,
                            nativeAmountMinor: amountMinor,
                            description,
                            category: nextCategory,
                            occurredAt,
                          });
                          void (async () => {
                            try {
                              const result = await updateTransactionAction({
                                id: tx.id,
                                amount: editAmount,
                                description: editDescription,
                                category: nextCategory,
                                date: editDate,
                                keepTimeFrom: tx.occurredAt,
                              });
                              if (!result.ok) {
                                applyMovementsEdit(tx.id, previous);
                                setEditingId(tx.id);
                                setActionError(result.error);
                                return;
                              }
                              adoptMutationFinance(result);
                            } finally {
                              actionLock.current = false;
                              setPendingAction(null);
                            }
                          })();
                        }}
                      >
                        {pendingAction === "save" ? "Sparar…" : "Spara"}
                      </button>
                      <button
                        type="button"
                        disabled={pendingAction != null}
                        className="numa-tap min-h-11 rounded-xl px-3 text-sm text-[var(--numa-muted)]"
                        onClick={() => {
                          if (pendingAction) return;
                          setEditingId(null);
                        }}
                      >
                        Avbryt
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={tx.listKey ?? tx.id}
                  className="numa-money-line items-start px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
                >
                  <div className="numa-money-line-label">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {sanitizeMoneyDescription(tx.description)}
                    </p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--numa-faint)]">
                      {viewFilter === "all" ? (
                        <span>{typeLabel(tx.transactionType)}</span>
                      ) : null}
                      {viewFilter === "all" || viewFilter === "expense" ? (
                        <button
                          type="button"
                          aria-pressed={viewCategory === spendCategoryName(tx.category)}
                          aria-label={
                            viewCategory === spendCategoryName(tx.category)
                              ? `Visa alla kategorier`
                              : `Visa ${spendCategoryName(tx.category)}`
                          }
                          onClick={() => selectCategory(spendCategoryName(tx.category))}
                          className={`numa-press numa-category-chip -my-1 inline-flex min-h-8 items-center rounded-full px-2 ${
                            viewCategory === spendCategoryName(tx.category)
                              ? "is-active bg-[var(--numa-ink)] font-semibold text-[var(--numa-card)]"
                              : "bg-[var(--numa-card)] font-medium text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
                          }`}
                        >
                          {spendCategoryName(tx.category)}
                        </button>
                      ) : null}
                      <span>
                        {formatListDateSv(tx.occurredAt, view.timeZone, {
                          withTime: true,
                        })}
                      </span>
                    </p>
                    {canEdit && (confirmId == null || confirmId === tx.id) ? (
                      confirmId === tx.id ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pendingAction != null}
                            className="numa-press numa-tap px-1 text-xs font-semibold text-[var(--numa-danger)]"
                            onClick={() => {
                              if (actionLock.current || pendingAction) return;
                              actionLock.current = true;
                              setPendingAction("void");
                              setActionError(null);
                              const before = captureOptimisticBalance();
                              const reopen = tx.id;
                              applyMovementsVoid(reopen);
                              setConfirmId(null);
                              void (async () => {
                                try {
                                  const result = await voidTransactionAction(tx.id);
                                  if (!result.ok) {
                                    undoOptimisticBalance(before);
                                    setConfirmId(reopen);
                                    setActionError(result.error);
                                    return;
                                  }
                                  invalidateAfterPlanLinkedVoid(tx);
                                  adoptMutationFinance(result);
                                } catch (error) {
                                  undoOptimisticBalance(before);
                                  setConfirmId(reopen);
                                  setActionError(
                                    error instanceof Error
                                      ? error.message
                                      : "Kunde inte ta bort rörelsen",
                                  );
                                } finally {
                                  actionLock.current = false;
                                  setPendingAction(null);
                                }
                              })();
                            }}
                          >
                            {pendingAction === "void" ? "Tar bort…" : "Ta bort"}
                          </button>
                          <button
                            type="button"
                            disabled={pendingAction != null}
                            className="numa-press numa-tap px-1 text-xs text-[var(--numa-muted)]"
                            onClick={() => {
                              if (pendingAction) return;
                              setConfirmId(null);
                            }}
                          >
                            Avbryt
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs font-semibold text-[var(--numa-accent)]"
                            onClick={() => {
                              const accountCurrency =
                                lastAccountsSnapshot()?.accounts.find(
                                  (account) => account.id === tx.accountId,
                                )?.currency;
                              const prefill = movementEditPrefill(tx, accountCurrency);
                              setEditingId(tx.id);
                              setConfirmId(null);
                              setEditAmount(minorToUi(prefill.amountMinor));
                              setEditDescription(tx.description);
                              setEditCategory(tx.category ?? "");
                              setEditDate(isoToDateInput(tx.occurredAt, view.timeZone));
                              setActionError(null);
                            }}
                          >
                            Redigera
                          </button>
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs text-[var(--numa-danger)]"
                            onClick={() => setConfirmId(tx.id)}
                          >
                            Ta bort
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <span className="numa-money-line-amt">
                    <MoneyDisplay
                      amountMinor={signed}
                      currency={tx.currency}
                      size="sm"
                      tone="neutral"
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

function PeriodChip({
  active,
  onClick,
  label,
  detail,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  detail?: string | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`numa-press inline-flex min-h-11 flex-col items-center justify-center rounded-full px-3 text-sm font-semibold ${
        active
          ? "bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
          : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
      }${className ? ` ${className}` : ""}`}
    >
      <span className="block leading-tight">{label}</span>
      {detail ? (
        <span className="block text-xs leading-tight font-medium">{detail}</span>
      ) : null}
    </button>
  );
}

function SummaryStat({
  label,
  amountMinor,
  currency,
  tone,
  signed = false,
}: {
  label: string;
  amountMinor: number;
  currency: MovementsSnapshot["currency"];
  tone: "positive" | "alarm" | "neutral";
  signed?: boolean;
}) {
  const color =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "alarm"
        ? "text-[var(--numa-alarm)]"
        : "text-[var(--numa-ink)]";

  return (
    <div className="min-w-0">
      <p className="numa-section-title">{label}</p>
      <div className={`numa-hero-money mt-2 ${color}`}>
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="md"
          tone={signed ? "signed" : "neutral"}
          wrap={false}
        />
      </div>
    </div>
  );
}
