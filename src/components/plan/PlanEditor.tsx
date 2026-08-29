"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import {
  addMonthsKey,
  dayOfMonthFromIso,
  dueDateInMonth,
  importableFixedExpenses,
  formatIsoDateOnlySv,
  formatListDateSv,
  isoToDateInput,
  nextCommittedCalendarDate,
  labelMonthNameSv,
  monthKeyFromDate,
  cumulativePlanSavingsMinor,
  matchPlanItemsToLedger,
  applyPlanItemEdits,
  isPlanPartiallySettled,
  isPlanSettled,
  planPartialBreakdown,
  planRowHeroMinor,
  previewPartialRemaining,
  projectCashCoverage,
  projectExtraSaldoSeries,
  projectPlanForMonth,
  remainingDueIso,
  settledAmountMinor,
  sortPlanRowsForList,
  sumCountsTowardCashMinor,
  yearFromMonthKey,
  visibleMonthKeysForYear,
} from "@/domain/finance";
import { parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";
import { PlanPiles } from "@/components/plan/PlanPiles";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { SV, planDoneLabel, planPartialLabel } from "@/features/copy/labels-sv";
import { lastPlanView, rememberPlanView } from "@/features/home/last-snapshot";
import { rememberLivePlan } from "@/components/plan/plan-cache";
import { useValueForKey } from "@/lib/hooks/use-value-for-key";
import {
  adoptServerPlanItems,
  applyMonthSavings,
  isTempPlanId,
  stampPlanItems,
  mergeReturnedItem,
  mergeReturnedItems,
  optimisticPlanItem,
  removeItemById,
  replaceItemById,
  revertMonthSavings,
  settlePlanItem,
} from "@/features/plan/optimistic";
import type { ActionResult } from "@/features/plan/actions";
import {
  createPlanExtraAction,
  createPlanIncomeAction,
  createPlanItemAction,
  deletePlanItemAction,
  importFixedExpensesFromPreviousMonthAction,
  setMonthSavingsAction,
  setPlanItemSettledAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

const EMPTY_MONTH_SPEND: Record<string, number> = {};
const EMPTY_LEDGER: CanonicalTransaction[] = [];

type BusyKey =
  | null
  | "savings"
  | "savings-clear"
  | "import"
  | "add-income"
  | "add-fixed"
  | "add-extra"
  | `edit:${string}`
  | `delete:${string}`
  | `settle:${string}`;

function minorToUi(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
}

function formatPlanFigure(amountMinor: number): string {
  const hasFraction = Math.abs(amountMinor) % 100 !== 0;
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(amountMinor / 100);
}

function PlanEquation({
  breakdown,
  restLabel,
}: {
  breakdown: { totalMinor: number; settledMinor: number; remainingMinor: number };
  restLabel?: string | null;
}) {
  return (
    <p className="numa-settle-eq">
      <span className="money">{formatPlanFigure(breakdown.totalMinor)}</span>
      <span aria-hidden>−</span>
      <span className="money">{formatPlanFigure(breakdown.settledMinor)}</span>
      <span aria-hidden>=</span>
      <span className="money is-remain">
        {formatPlanFigure(breakdown.remainingMinor)}
      </span>
      {restLabel ? (
        <span className="numa-settle-rest">
          · {SV.resten} {restLabel}
        </span>
      ) : null}
    </p>
  );
}

function labelIncomeDateSv(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return formatListDateSv(iso, timeZone);
}

function commitCalendarDate(
  raw: string,
  current: string,
  onChange: (value: string) => void,
) {
  const next = nextCommittedCalendarDate(raw, current);
  if (next) onChange(next);
}

function PlanDateField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-h-11 min-w-[9.5rem]">
      <div
        aria-hidden
        className="pointer-events-none flex min-h-11 w-full items-center rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-left text-sm"
      >
        <span className={value ? "font-medium" : "text-[var(--numa-faint)]"}>
          {value ? formatIsoDateOnlySv(value) : "ÅÅÅÅ-MM-DD"}
        </span>
      </div>
      {/*
        Native input is the hit target so iOS and desktop both commit the
        tapped day. Do not stretch ::-webkit-calendar-picker-indicator or
        call preventDefault — those stop Chromium from writing input.value.
      */}
      <input
        type="date"
        lang="sv-SE"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => commitCalendarDate(e.target.value, value, onChange)}
        onInput={(e) =>
          commitCalendarDate((e.target as HTMLInputElement).value, value, onChange)
        }
        className="numa-date-input"
      />
    </div>
  );
}

function parsePlanAmount(raw: string): number | { error: string } {
  try {
    const amountMinor = parseUiAmountToMinor(raw);
    if (amountMinor < 0) return { error: "Belopp kan inte vara negativt" };
    return amountMinor;
  } catch {
    return { error: "Ogiltigt belopp" };
  }
}

export function PlanEditor({
  items,
  currency,
  timeZone,
  bankBalanceMinor = null,
  spendingByMonthKey = EMPTY_MONTH_SPEND,
  ledgerTransactions = EMPTY_LEDGER,
  focusAdd = null,
  stepHint = null,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
  bankBalanceMinor?: number | null;
  spendingByMonthKey?: Record<string, number>;
  ledgerTransactions?: CanonicalTransaction[];
  focusAdd?: null | "income" | "fixed";
  stepHint?: string | null;
}) {
  const currentMonthKey = useMemo(
    () => monthKeyFromDate(new Date(), timeZone),
    [timeZone],
  );
  const [viewYear, setViewYear] = useState(() => {
    const remembered = lastPlanView();
    return remembered?.viewYear ?? yearFromMonthKey(currentMonthKey);
  });
  const [monthKey, setMonthKey] = useState(
    () => lastPlanView()?.monthKey ?? currentMonthKey,
  );
  rememberPlanView({ monthKey, viewYear });
  const [localItems, setLocalItems] = useState(items);
  const incomingStamp = stampPlanItems(items);
  const [itemsStamp, setItemsStamp] = useState(incomingStamp);
  const ownerId = localItems[0]?.userId ?? items[0]?.userId ?? "";

  const monthKeys = useMemo(() => visibleMonthKeysForYear(viewYear), [viewYear]);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [partialId, setPartialId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialDate, setPartialDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [addKind, setAddKind] = useState<null | "income" | "fixed" | "extra">(focusAdd);
  const focusCardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!focusAdd) return;
    setAddKind(focusAdd);
    const id = window.setTimeout(() => {
      focusCardRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "smooth",
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [focusAdd]);
  function publishItems(next: PlanItem[]) {
    rememberLivePlan({
      items: next,
      currency,
      timeZone,
      bankBalanceMinor,
      spendingByMonthKey,
      ledgerTransactions,
    });
  }

  if (!busy && incomingStamp !== itemsStamp) {
    setItemsStamp(incomingStamp);
    setLocalItems((current) => {
      const next = adoptServerPlanItems(current, items);
      publishItems(next);
      return next;
    });
  }

  const isPastMonth = monthKey < currentMonthKey;
  const previousMonthKey = addMonthsKey(monthKey, -1);
  const importableFixed = useMemo(
    () =>
      importableFixedExpenses({
        items: localItems,
        fromMonthKey: previousMonthKey,
        toMonthKey: monthKey,
        timeZone,
      }),
    [localItems, previousMonthKey, monthKey, timeZone],
  );
  const canImportFixed = !isPastMonth && importableFixed.length > 0;

  const projection = useMemo(
    () => projectPlanForMonth(localItems, monthKey, timeZone),
    [localItems, monthKey, timeZone],
  );

  const coverage = useMemo(
    () =>
      projectCashCoverage({
        planItems: localItems,
        transactions: ledgerTransactions,
        monthKey,
        timeZone,
        saldoMinor: bankBalanceMinor,
      }),
    [localItems, ledgerTransactions, monthKey, timeZone, bankBalanceMinor],
  );
  const matchedIncomeIds = useMemo(
    () =>
      matchPlanItemsToLedger({
        items: projection.incomes,
        transactions: ledgerTransactions,
        kind: "income",
        monthKey,
        timeZone,
      }),
    [projection.incomes, ledgerTransactions, monthKey, timeZone],
  );
  const matchedExpenseIds = useMemo(
    () =>
      matchPlanItemsToLedger({
        items: projection.items,
        transactions: ledgerTransactions,
        kind: "expense",
        monthKey,
        timeZone,
      }),
    [projection.items, ledgerTransactions, monthKey, timeZone],
  );
  const savingsTotalMinor = useMemo(
    () => cumulativePlanSavingsMinor(localItems, monthKey, timeZone),
    [localItems, monthKey, timeZone],
  );
  const monthName = labelMonthNameSv(monthKey);
  const yearThroughKey = monthKeys[monthKeys.length - 1] ?? monthKey;
  const yearExtra = useMemo(
    () =>
      projectExtraSaldoSeries({
        planItems: localItems,
        spendingByMonthKey,
        throughMonthKey: yearThroughKey,
        currentMonthKey,
        timeZone,
      }),
    [localItems, spendingByMonthKey, yearThroughKey, currentMonthKey, timeZone],
  );
  const extraByMonth = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of yearExtra) {
      out[row.monthKey] = row.monthResultMinor + row.carriedInMinor;
    }
    return out;
  }, [yearExtra]);
  const savingsByMonth = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of monthKeys) {
      out[key] = projectPlanForMonth(localItems, key, timeZone).savingsMinor;
    }
    return out;
  }, [localItems, monthKeys, timeZone]);
  const monthChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [savingsAmount, setSavingsAmount] = useValueForKey(
    projection.savingsMinor > 0 ? minorToUi(projection.savingsMinor) : "",
    `${monthKey}:${projection.savingsMinor}`,
  );
  const [incomeDate, setIncomeDate] = useState(`${monthKey}-25`);
  const [extraDate, setExtraDate] = useState(`${monthKey}-15`);
  const [expenseDate, setExpenseDate] = useState(`${monthKey}-01`);
  const [dateMonthKey, setDateMonthKey] = useState(monthKey);
  if (dateMonthKey !== monthKey) {
    setDateMonthKey(monthKey);
    setIncomeDate((prev) => (prev.startsWith(monthKey) ? prev : `${monthKey}-25`));
    setExtraDate((prev) => (prev.startsWith(monthKey) ? prev : `${monthKey}-15`));
    setExpenseDate((prev) => (prev.startsWith(monthKey) ? prev : `${monthKey}-01`));
  }

  useEffect(() => {
    monthChipRefs.current[monthKey]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [monthKey, monthKeys]);

  function selectMonth(key: string) {
    setMonthKey(key);
    setViewYear(yearFromMonthKey(key));
    setEditingId(null);
    setPartialId(null);
    setAddKind(null);
  }

  function shiftYear(delta: number) {
    const nextYear = viewYear + delta;
    const keys = visibleMonthKeysForYear(nextYear);
    const preferred = `${nextYear}-${monthKey.slice(5)}`;
    const nextKey = keys.includes(preferred) ? preferred : keys[0]!;
    setViewYear(nextYear);
    setMonthKey(nextKey);
    setEditingId(null);
    setPartialId(null);
    setAddKind(null);
  }

  async function runMutation(opts: {
    busy: BusyKey;
    apply: (items: PlanItem[]) => PlanItem[];
    revert: (items: PlanItem[]) => PlanItem[];
    action: () => Promise<ActionResult>;
    reconcile?: (
      items: PlanItem[],
      result: Extract<ActionResult, { ok: true }>,
    ) => PlanItem[];
  }): Promise<boolean> {
    setError(null);
    setBusy(opts.busy);
    setLocalItems((current) => {
      const next = opts.apply(current);
      publishItems(next);
      return next;
    });
    try {
      const result = await opts.action();
      if (!result.ok) {
        setLocalItems((current) => {
          const next = opts.revert(current);
          publishItems(next);
          return next;
        });
        setError(result.error);
        return false;
      }
      setLocalItems((current) => {
        const next = opts.reconcile
          ? opts.reconcile(current, result)
          : result.item
            ? mergeReturnedItem(current, result.item)
            : result.items
              ? mergeReturnedItems(current, result.items, new Set())
              : current;
        publishItems(next);
        return next;
      });
      return true;
    } catch (err) {
      setLocalItems((current) => {
        const next = opts.revert(current);
        publishItems(next);
        return next;
      });
      setError(err instanceof Error ? err.message : "Något gick fel");
      return false;
    } finally {
      setBusy((current) => (current === opts.busy ? null : current));
    }
  }

  function commitAdd(opts: {
    busy: Extract<BusyKey, "add-income" | "add-fixed" | "add-extra">;
    addKind: "income" | "fixed" | "extra";
    name: string;
    amount: string;
    date: string;
    item: {
      kind: "expected" | "mandatory";
      cadence: string;
      nextDueAt: string;
    };
    clear: () => void;
    restore: (name: string, amount: string) => void;
    action: (name: string, amount: string, date: string) => Promise<ActionResult>;
  }) {
    const parsed = parsePlanAmount(opts.amount);
    if (typeof parsed !== "number") {
      setError(parsed.error);
      return;
    }
    const created = optimisticPlanItem({
      name: opts.name,
      kind: opts.item.kind,
      amountMinor: parsed,
      currency,
      cadence: opts.item.cadence,
      nextDueAt: opts.item.nextDueAt,
      userId: ownerId,
    });
    const name = opts.name;
    const amount = opts.amount;
    const date = opts.date;
    opts.clear();
    setAddKind(null);
    void runMutation({
      busy: opts.busy,
      apply: (rows) => [...rows, created],
      revert: (rows) => removeItemById(rows, created.id),
      action: () => opts.action(name, amount, date),
      reconcile: (rows, result) =>
        result.item ? mergeReturnedItem(rows, result.item, created.id) : rows,
    }).then((ok) => {
      if (!ok) {
        opts.restore(name, amount);
        setAddKind(opts.addKind);
      }
    });
  }

  function settleRow(
    id: string,
    settled: boolean,
    amount?: string,
    remainingDate?: string,
  ) {
    if (isTempPlanId(id)) return;
    let settledMinor: number | null | undefined;
    let remainingDueAt: string | null | undefined;
    if (!settled) {
      settledMinor = null;
      remainingDueAt = null;
    } else if (amount != null) {
      const parsed = parsePlanAmount(amount);
      if (typeof parsed !== "number") {
        setError(parsed.error);
        return;
      }
      if (parsed <= 0) {
        setError("Belopp måste vara större än 0");
        return;
      }
      settledMinor = parsed;
      remainingDueAt = remainingDate ? `${remainingDate}T12:00:00.000Z` : null;
    }
    const previous = localItems.find((row) => row.id === id);
    void runMutation({
      busy: `settle:${id}`,
      apply: (rows) =>
        settlePlanItem(rows, id, { settled, settledMinor, remainingDueAt }),
      revert: (rows) => (previous ? replaceItemById(rows, id, previous) : rows),
      action: () =>
        setPlanItemSettledAction({
          id,
          settled,
          amount,
          remainingDate,
        }),
      reconcile: (rows, result) =>
        result.item ? mergeReturnedItem(rows, result.item) : rows,
    }).then((ok) => {
      if (ok) {
        setPartialId(null);
        setPartialAmount("");
        setPartialDate("");
      }
    });
  }

  function startPartial(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(null);
    setPartialId(item.id);
    const already = settledAmountMinor(item);
    setPartialAmount(already > 0 ? minorToUi(already) : "");
    const rest = remainingDueIso(item);
    setPartialDate(isoToDateInput(rest, timeZone) || `${monthKey}-01`);
  }

  function rowBusy(): {
    pendingId: string | null;
    pendingAction: "save" | "delete" | "settle" | null;
  } {
    if (!busy || !busy.includes(":")) {
      return { pendingId: null, pendingAction: null };
    }
    const id = busy.slice(busy.indexOf(":") + 1);
    if (busy.startsWith("edit:")) return { pendingId: id, pendingAction: "save" };
    if (busy.startsWith("delete:")) return { pendingId: id, pendingAction: "delete" };
    if (busy.startsWith("settle:")) return { pendingId: id, pendingAction: "settle" };
    return { pendingId: null, pendingAction: null };
  }

  function startEditIncome(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setPartialId(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDate(isoToDateInput(remainingDueIso(item), timeZone));
  }

  function startEditExpense(item: PlanItem) {
    startEditIncome(item);
  }

  function startEditExtra(item: PlanItem) {
    startEditIncome(item);
  }

  function saveEditedItem(id: string, patch: Partial<PlanItem>) {
    const previous = localItems.find((row) => row.id === id);
    if (!previous) return;
    const next = applyPlanItemEdits(previous, {
      name: patch.name,
      amountMinor: patch.amountMinor,
      nextDueAt: patch.nextDueAt,
    });
    const pickedDate = patch.nextDueAt
      ? isoToDateInput(patch.nextDueAt, timeZone) || undefined
      : undefined;
    void runMutation({
      busy: `edit:${id}`,
      apply: (rows) => replaceItemById(rows, id, next),
      revert: (rows) => replaceItemById(rows, id, previous),
      action: () =>
        updatePlanItemAction({
          id,
          name: next.name,
          amount: editAmount,
          date: pickedDate,
        }),
      reconcile: (rows, result) =>
        result.item ? mergeReturnedItem(rows, result.item) : rows,
    }).then((ok) => {
      if (ok) setEditingId(null);
    });
  }

  return (
    <div className="space-y-8">
      <section className="animate-rise-delay-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftYear(-1)}
              className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
              aria-label="Föregående år"
            >
              ← {viewYear - 1}
            </button>
            <p className="min-w-[3.5rem] text-center text-base font-semibold tracking-tight">
              {viewYear}
            </p>
            <button
              type="button"
              onClick={() => shiftYear(1)}
              className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
              aria-label="Nästa år"
            >
              {viewYear + 1} →
            </button>
          </div>
          {monthKey !== currentMonthKey ? (
            <button
              type="button"
              onClick={() => selectMonth(currentMonthKey)}
              className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
            >
              Denna månad
            </button>
          ) : (
            <p className="text-xs font-medium text-[var(--numa-faint)]">
              Bläddra bakåt och framåt — historik ändras inte
            </p>
          )}
        </div>

        <MonthChipStrip>
          {monthKeys.map((key) => {
            const livingDot = (extraByMonth[key] ?? 0) > 0;
            const saveDot = (savingsByMonth[key] ?? 0) > 0;
            return (
              <button
                key={key}
                type="button"
                id={`plan-month-${key}`}
                ref={(el) => {
                  monthChipRefs.current[key] = el;
                }}
                onClick={() => selectMonth(key)}
                className={`numa-press numa-month-chip min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold capitalize ${
                  monthKey === key
                    ? "is-active bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[0_8px_20px_rgba(22,21,19,0.16)]"
                    : key === currentMonthKey
                      ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)] ring-1 ring-[var(--numa-accent)]/35"
                      : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-accent-ink)]"
                }`}
              >
                {labelMonthNameSv(key)}
                {livingDot || saveDot ? (
                  <span className="numa-month-dots" aria-hidden>
                    {livingDot ? <i className="is-saldo" /> : null}
                    {saveDot ? <i className="is-save" /> : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </MonthChipStrip>

        <PlanPiles
          coverage={coverage}
          monthName={monthName}
          currency={currency}
          savingsTotalMinor={savingsTotalMinor}
          savingsThisMonthMinor={projection.savingsMinor}
          savingsByMonth={savingsByMonth}
          monthKeys={monthKeys}
          savingsAmount={savingsAmount}
          onSavingsAmount={setSavingsAmount}
          savingsBusy={busy === "savings"}
          clearBusy={busy === "savings-clear"}
          onSaveSavings={() => {
            const parsed = parsePlanAmount(
              savingsAmount.trim() === "" ? "0" : savingsAmount,
            );
            if (typeof parsed !== "number") {
              setError(parsed.error);
              return;
            }
            let tempId: string | undefined;
            let previous: PlanItem | null = null;
            void runMutation({
              busy: "savings",
              apply: (rows) => {
                const applied = applyMonthSavings(
                  rows,
                  monthKey,
                  parsed,
                  currency,
                  timeZone,
                );
                tempId = applied.tempId;
                previous = applied.previous;
                return applied.items;
              },
              revert: (rows) =>
                revertMonthSavings(rows, monthKey, previous, tempId, timeZone),
              action: () =>
                setMonthSavingsAction({
                  monthKey,
                  amount: savingsAmount.trim() === "" ? "0" : savingsAmount,
                }),
              reconcile: (rows, result) =>
                result.item ? mergeReturnedItem(rows, result.item, tempId) : rows,
            });
          }}
          onClearSavings={() => {
            let previous: PlanItem | null = null;
            void runMutation({
              busy: "savings-clear",
              apply: (rows) => {
                const applied = applyMonthSavings(rows, monthKey, 0, currency, timeZone);
                previous = applied.previous;
                return applied.items;
              },
              revert: (rows) =>
                revertMonthSavings(rows, monthKey, previous, undefined, timeZone),
              action: () =>
                setMonthSavingsAction({
                  monthKey,
                  amount: "0",
                }),
            }).then((ok) => {
              if (ok) setSavingsAmount("");
            });
          }}
        />

        <div className="numa-panel numa-split">
          <div>
            <p className="numa-section-title">{SV.intakter}</p>
            <div className="mt-1.5 text-[var(--numa-positive)]">
              <MoneyDisplay
                amountMinor={coverage.incomingMinor}
                currency={currency}
                size="md"
                compact
                align="start"
                wrap={false}
              />
            </div>
          </div>
          <div className="numa-split-rule" aria-hidden />
          <div>
            <p className="numa-section-title">{SV.utgifter}</p>
            <div className="numa-amt-out mt-1.5">
              <MoneyDisplay
                amountMinor={coverage.unpaidMinor}
                currency={currency}
                size="md"
                compact
                align="start"
                wrap={false}
              />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="animate-rise-delay-2 grid gap-4">
        <PlanCard
          title="Intäkter"
          totalLabel="Summa"
          totalMinor={sumCountsTowardCashMinor(projection.incomes, matchedIncomeIds)}
          currency={currency}
          banner={focusAdd === "income" ? stepHint : null}
          cardRef={focusAdd === "income" ? focusCardRef : undefined}
        >
          <PlanRows
            items={projection.incomes}
            settleKind="income"
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDate}
            timeZone={timeZone}
            emptyHint="Lägg in lön eller CSN."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            pendingId={rowBusy().pendingId}
            pendingAction={rowBusy().pendingAction}
            matchedIds={matchedIncomeIds}
            onSettle={settleRow}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket har kommit in?"
            remainingDatePrompt="När kommer resten?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => settleRow(id, true, partialAmount, partialDate)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditIncome}
            onCancelEdit={() => {
              setEditingId(null);
              setPartialId(null);
            }}
            onSaveEdit={(id) => {
              const parsed = parsePlanAmount(editAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              saveEditedItem(id, {
                name: editName.trim(),
                amountMinor: parsed,
                nextDueAt: editDate ? `${editDate}T12:00:00.000Z` : null,
              });
            }}
            onDelete={(id) => {
              const previous = localItems.find((row) => row.id === id);
              if (!previous) return;
              void runMutation({
                busy: `delete:${id}`,
                apply: (rows) => removeItemById(rows, id),
                revert: (rows) => [...rows, previous],
                action: () => deletePlanItemAction(id),
              });
            }}
          />

          <InlineAdd
            name={incomeName}
            amount={incomeAmount}
            extra={incomeDate}
            extraLabel="Datum"
            namePlaceholder="t.ex. Lön, Trukks, CSN"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till intäkt"
            collapsedLabel="Lägg till intäkt"
            open={addKind === "income"}
            scrollOnOpen={focusAdd !== "income"}
            onOpen={() => setAddKind("income")}
            onClose={() => setAddKind(null)}
            busy={busy === "add-income"}
            onName={setIncomeName}
            onAmount={setIncomeAmount}
            onExtra={setIncomeDate}
            onSubmit={() => {
              commitAdd({
                busy: "add-income",
                addKind: "income",
                name: incomeName,
                amount: incomeAmount,
                date: incomeDate,
                item: {
                  kind: "expected",
                  cadence: "income",
                  nextDueAt: `${incomeDate}T12:00:00.000Z`,
                },
                clear: () => {
                  setIncomeName("");
                  setIncomeAmount("");
                },
                restore: (name, amount) => {
                  setIncomeName(name);
                  setIncomeAmount(amount);
                },
                action: (name, amount, date) =>
                  createPlanIncomeAction({ name, amount, date }),
              });
            }}
          />
        </PlanCard>
      </div>

      <div className="animate-rise-delay-3 grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Fasta utgifter"
          hint="Gäller bara den här månaden."
          totalLabel="Summa"
          totalMinor={sumCountsTowardCashMinor(projection.fixedItems, matchedExpenseIds)}
          currency={currency}
          banner={focusAdd === "fixed" ? stepHint : null}
          cardRef={focusAdd === "fixed" ? focusCardRef : undefined}
        >
          {canImportFixed ? (
            <button
              type="button"
              disabled={busy === "import"}
              className="numa-btn numa-btn-soft w-full"
              onClick={() => {
                const temps = importableFixed.map((src) =>
                  optimisticPlanItem({
                    name: src.name,
                    kind: src.kind,
                    amountMinor: src.amountMinor,
                    currency: src.currency || currency,
                    cadence: "monthly",
                    nextDueAt: dueDateInMonth(
                      monthKey,
                      src.nextDueAt ? dayOfMonthFromIso(src.nextDueAt) : 1,
                    ),
                    userId: ownerId,
                  }),
                );
                const tempIds = new Set(temps.map((row) => row.id));
                void runMutation({
                  busy: "import",
                  apply: (rows) => [...rows, ...temps],
                  revert: (rows) => rows.filter((row) => !tempIds.has(row.id)),
                  action: () =>
                    importFixedExpensesFromPreviousMonthAction({
                      monthKey,
                    }),
                  reconcile: (rows, result) =>
                    result.items ? mergeReturnedItems(rows, result.items, tempIds) : rows,
                });
              }}
            >
              {busy === "import"
                ? "Läser in…"
                : `Läs in från ${labelMonthNameSv(previousMonthKey)}`}
            </button>
          ) : null}

          <PlanRows
            items={projection.fixedItems}
            settleKind="expense"
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDate}
            timeZone={timeZone}
            emptyHint={
              canImportFixed
                ? `Läs in från ${labelMonthNameSv(previousMonthKey)}, eller lägg till nya.`
                : "Hyra och räkningar du måste betala."
            }
            subtitle={(item) =>
              item.nextDueAt ? formatListDateSv(item.nextDueAt, timeZone) : "Datum saknas"
            }
            pendingId={rowBusy().pendingId}
            pendingAction={rowBusy().pendingAction}
            matchedIds={matchedExpenseIds}
            onSettle={settleRow}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket är betalt?"
            remainingDatePrompt="När ska resten betalas?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => settleRow(id, true, partialAmount, partialDate)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditExpense}
            onCancelEdit={() => {
              setEditingId(null);
              setPartialId(null);
            }}
            onSaveEdit={(id) => {
              const parsed = parsePlanAmount(editAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              saveEditedItem(id, {
                name: editName.trim(),
                amountMinor: parsed,
                nextDueAt: editDate ? `${editDate}T12:00:00.000Z` : null,
              });
            }}
            onDelete={(id) => {
              const previous = localItems.find((row) => row.id === id);
              if (!previous) return;
              void runMutation({
                busy: `delete:${id}`,
                apply: (rows) => removeItemById(rows, id),
                revert: (rows) => [...rows, previous],
                action: () => deletePlanItemAction(id),
              });
            }}
          />

          <InlineAdd
            name={expenseName}
            amount={expenseAmount}
            extra={expenseDate}
            extraLabel="Datum"
            namePlaceholder="t.ex. Hyra, El, Netflix"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till fast utgift"
            collapsedLabel="Lägg till fast utgift"
            open={addKind === "fixed"}
            scrollOnOpen={focusAdd !== "fixed"}
            onOpen={() => setAddKind("fixed")}
            onClose={() => setAddKind(null)}
            busy={busy === "add-fixed"}
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onExtra={setExpenseDate}
            onSubmit={() => {
              commitAdd({
                busy: "add-fixed",
                addKind: "fixed",
                name: expenseName,
                amount: expenseAmount,
                date: expenseDate,
                item: {
                  kind: "mandatory",
                  cadence: "monthly",
                  nextDueAt: `${expenseDate}T12:00:00.000Z`,
                },
                clear: () => {
                  setExpenseName("");
                  setExpenseAmount("");
                },
                restore: (name, amount) => {
                  setExpenseName(name);
                  setExpenseAmount(amount);
                },
                action: (name, amount, date) =>
                  createPlanItemAction({
                    name,
                    kind: "mandatory",
                    amount,
                    date,
                    monthKey,
                  }),
              });
            }}
          />
        </PlanCard>

        <PlanCard
          title="Extra utgifter"
          totalLabel="Summa"
          totalMinor={sumCountsTowardCashMinor(projection.extraItems, matchedExpenseIds)}
          currency={currency}
        >
          <PlanRows
            items={projection.extraItems}
            settleKind="expense"
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDate}
            timeZone={timeZone}
            emptyHint="En räkning som bara kommer en gång."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            pendingId={rowBusy().pendingId}
            pendingAction={rowBusy().pendingAction}
            matchedIds={matchedExpenseIds}
            onSettle={settleRow}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket är betalt?"
            remainingDatePrompt="När ska resten betalas?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => settleRow(id, true, partialAmount, partialDate)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditExtra}
            onCancelEdit={() => {
              setEditingId(null);
              setPartialId(null);
            }}
            onSaveEdit={(id) => {
              const parsed = parsePlanAmount(editAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              saveEditedItem(id, {
                name: editName.trim(),
                amountMinor: parsed,
                nextDueAt: editDate ? `${editDate}T12:00:00.000Z` : null,
              });
            }}
            onDelete={(id) => {
              const previous = localItems.find((row) => row.id === id);
              if (!previous) return;
              void runMutation({
                busy: `delete:${id}`,
                apply: (rows) => removeItemById(rows, id),
                revert: (rows) => [...rows, previous],
                action: () => deletePlanItemAction(id),
              });
            }}
          />

          <InlineAdd
            name={extraName}
            amount={extraAmount}
            extra={extraDate}
            extraLabel="Datum"
            namePlaceholder="t.ex. Lån, Flygbiljett"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till extra"
            collapsedLabel="Lägg till extra"
            open={addKind === "extra"}
            onOpen={() => setAddKind("extra")}
            onClose={() => setAddKind(null)}
            busy={busy === "add-extra"}
            onName={setExtraName}
            onAmount={setExtraAmount}
            onExtra={setExtraDate}
            onSubmit={() => {
              commitAdd({
                busy: "add-extra",
                addKind: "extra",
                name: extraName,
                amount: extraAmount,
                date: extraDate,
                item: {
                  kind: "expected",
                  cadence: "once",
                  nextDueAt: `${extraDate}T12:00:00.000Z`,
                },
                clear: () => {
                  setExtraName("");
                  setExtraAmount("");
                },
                restore: (name, amount) => {
                  setExtraName(name);
                  setExtraAmount(amount);
                },
                action: (name, amount, date) =>
                  createPlanExtraAction({ name, amount, date }),
              });
            }}
          />
        </PlanCard>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  hint,
  banner,
  totalLabel,
  totalMinor,
  currency,
  children,
  cardRef,
}: {
  title: string;
  hint?: string;
  banner?: string | null;
  totalLabel: string;
  totalMinor: number;
  currency: CurrencyCode;
  children: ReactNode;
  cardRef?: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={cardRef}
      className="numa-panel flex scroll-mt-[5.5rem] flex-col gap-4 p-6"
    >
      {banner ? (
        <p className="rounded-[1.15rem] bg-[var(--numa-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--numa-accent-ink)]">
          {banner}
        </p>
      ) : null}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {hint ? (
            <p className="mt-0.5 text-sm text-[var(--numa-muted)]">{hint}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="numa-section-title">{totalLabel}</p>
          <div className="mt-0.5 text-[var(--numa-ink)]">
            <MoneyDisplay
              amountMinor={totalMinor}
              currency={currency}
              size="md"
              compact
              align="end"
              wrap={false}
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </section>
  );
}

function PlanRows({
  items,
  settleKind,
  currency,
  timeZone,
  editingId,
  editName,
  editAmount,
  editExtra,
  emptyHint = "Inget inlagt.",
  subtitle,
  pendingId = null,
  pendingAction = null,
  matchedIds,
  onSettle,
  partialId,
  partialAmount,
  partialDate,
  partialPrompt,
  remainingDatePrompt,
  onPartialAmount,
  onPartialDate,
  onStartPartial,
  onCancelPartial,
  onSavePartial,
  onEditName,
  onEditAmount,
  onEditExtra,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: PlanItem[];
  settleKind: "income" | "expense";
  currency: CurrencyCode;
  timeZone: string;
  editingId: string | null;
  editName: string;
  editAmount: string;
  editExtra: string;
  emptyHint?: string;
  subtitle: (item: PlanItem) => string;
  pendingId?: string | null;
  pendingAction?: "save" | "delete" | "settle" | null;
  matchedIds: Set<string>;
  onSettle: (id: string, settled: boolean) => void;
  partialId: string | null;
  partialAmount: string;
  partialDate: string;
  partialPrompt: string;
  remainingDatePrompt: string;
  onPartialAmount: (v: string) => void;
  onPartialDate: (v: string) => void;
  onStartPartial: (item: PlanItem) => void;
  onCancelPartial: () => void;
  onSavePartial: (id: string) => void;
  onEditName: (v: string) => void;
  onEditAmount: (v: string) => void;
  onEditExtra: (v: string) => void;
  onStartEdit: (item: PlanItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="py-4 text-sm text-[var(--numa-muted)]">{emptyHint}</p>;
  }

  const rows = sortPlanRowsForList(items, matchedIds);

  return (
    <ul className="numa-plan-list">
      {rows.map((item) => {
        const rowCurrency = (item.currency || currency) as CurrencyCode;
        const dateLabel = subtitle(item);
        const restIso = remainingDueIso(item);
        const restLabel = restIso ? formatListDateSv(restIso, timeZone) : null;
        const breakdown = planPartialBreakdown(item);
        const matched = matchedIds.has(item.id);
        const explicitSettled = isPlanSettled(item);
        const partial = !matched && isPlanPartiallySettled(item);
        const settled = explicitSettled || (matched && !partial);
        const canUndo = explicitSettled || partial;

        if (editingId === item.id) {
          return (
            <li key={item.id} className="numa-plan-row is-form space-y-3">
              <input
                value={editName}
                onChange={(e) => onEditName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => onEditAmount(e.target.value)}
                  className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
                />
                <PlanDateField
                  value={editExtra}
                  onChange={onEditExtra}
                  ariaLabel="Datum"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pendingId === item.id && pendingAction === "save"}
                  className="numa-btn numa-btn-accent min-h-10 flex-1"
                  onClick={() => onSaveEdit(item.id)}
                >
                  {pendingId === item.id && pendingAction === "save"
                    ? "Sparar…"
                    : "Spara"}
                </button>
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                  onClick={onCancelEdit}
                >
                  Avbryt
                </button>
              </div>
            </li>
          );
        }

        if (partialId === item.id) {
          let typedMinor: number | null = null;
          if (partialAmount.trim()) {
            try {
              typedMinor = parseUiAmountToMinor(partialAmount);
            } catch {
              typedMinor = null;
            }
          }
          const preview = previewPartialRemaining(item.amountMinor, typedMinor);
          return (
            <li key={item.id} className="numa-plan-row is-form is-partial space-y-3">
              <div>
                <p className="numa-plan-name">{item.name}</p>
                <p className="numa-plan-meta">{planPartialLabel(settleKind)}</p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--numa-muted)]">
                  {partialPrompt}
                </span>
                <input
                  inputMode="decimal"
                  value={partialAmount}
                  onChange={(e) => onPartialAmount(e.target.value)}
                  placeholder={`Belopp (${rowCurrency})`}
                  className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
                />
              </label>
              {preview ? (
                <div className="numa-partial-preview">
                  <p className="numa-section-title">Kvar</p>
                  <MoneyDisplay
                    amountMinor={preview.remainingMinor}
                    currency={rowCurrency}
                    size="md"
                    compact
                    align="start"
                  />
                  <PlanEquation breakdown={preview} />
                </div>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--numa-muted)]">
                  {remainingDatePrompt}
                </span>
                <PlanDateField
                  value={partialDate}
                  onChange={onPartialDate}
                  ariaLabel={remainingDatePrompt}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    (pendingId === item.id && pendingAction === "settle") ||
                    !partialAmount.trim() ||
                    !partialDate.trim()
                  }
                  className="numa-btn numa-btn-accent min-h-10 flex-1"
                  onClick={() => onSavePartial(item.id)}
                >
                  {pendingId === item.id && pendingAction === "settle"
                    ? "Sparar…"
                    : "Spara"}
                </button>
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                  onClick={onCancelPartial}
                >
                  Avbryt
                </button>
              </div>
            </li>
          );
        }

        const doneLabel = planDoneLabel(settleKind);
        const partialLabel = planPartialLabel(settleKind);
        const menuItems: OverflowMenuItem[] = [];
        if (!matched && !settled) {
          menuItems.push({
            label: doneLabel,
            disabled: pendingId === item.id && pendingAction === "settle",
            onSelect: () => onSettle(item.id, true),
          });
          menuItems.push({
            label: partialLabel,
            onSelect: () => {
              setConfirmId(null);
              onStartPartial(item);
            },
          });
        }
        menuItems.push({
          label: "Redigera",
          onSelect: () => {
            setConfirmId(null);
            onStartEdit(item);
          },
        });
        if (canUndo) {
          menuItems.push({
            label: SV.angraKlar,
            disabled: pendingId === item.id && pendingAction === "settle",
            onSelect: () => onSettle(item.id, false),
          });
        }
        menuItems.push({
          label: "Ta bort",
          tone: "danger",
          disabled: pendingId === item.id && pendingAction === "delete",
          onSelect: () => setConfirmId(item.id),
        });

        const rowState = [
          settled ? "is-settled" : partial ? "is-partial" : "",
          isTempPlanId(item.id) ? "is-fresh" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={item.id} className={`numa-plan-row ${rowState}`.trim()}>
            <div className="numa-plan-copy">
              <p className="numa-plan-name" title={item.name}>
                {item.name}
              </p>
              {breakdown ? (
                <PlanEquation breakdown={breakdown} restLabel={restLabel} />
              ) : (
                <p className="numa-plan-meta">{dateLabel}</p>
              )}
            </div>
            {isTempPlanId(item.id) ? (
              <div className="numa-plan-figures">
                <MoneyDisplay
                  amountMinor={planRowHeroMinor(item)}
                  currency={rowCurrency}
                  size="md"
                  compact
                  align="end"
                  wrap={false}
                />
              </div>
            ) : confirmId === item.id ? (
              <div className="numa-plan-confirm">
                <button
                  type="button"
                  disabled={pendingId === item.id && pendingAction === "delete"}
                  className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-[var(--numa-danger)] hover:bg-[var(--numa-danger-soft)]/70 disabled:opacity-45"
                  onClick={() => {
                    onDelete(item.id);
                    setConfirmId(null);
                  }}
                >
                  Ta bort
                </button>
                <button
                  type="button"
                  className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm text-[var(--numa-muted)]"
                  onClick={() => setConfirmId(null)}
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <>
                <div className="numa-plan-figures">
                  <MoneyDisplay
                    amountMinor={planRowHeroMinor(item)}
                    currency={rowCurrency}
                    size="md"
                    compact
                    align="end"
                    wrap={false}
                  />
                  {settled ? (
                    canUndo ? (
                      <button
                        type="button"
                        className="numa-chip numa-chip-mint self-end"
                        disabled={pendingId === item.id && pendingAction === "settle"}
                        aria-label={`Ångra ${doneLabel}`}
                        onClick={() => onSettle(item.id, false)}
                      >
                        {doneLabel}
                      </button>
                    ) : (
                      <span className="numa-chip numa-chip-mint self-end">
                        {doneLabel}
                      </span>
                    )
                  ) : partial ? (
                    <button
                      type="button"
                      className="numa-chip numa-chip-spend self-end"
                      disabled={pendingId === item.id && pendingAction === "settle"}
                      aria-label={`Ångra ${partialLabel}`}
                      onClick={() => onSettle(item.id, false)}
                    >
                      {SV.delvis}
                    </button>
                  ) : null}
                </div>
                <div className="numa-plan-menu">
                  <OverflowMenu label={`Åtgärder för ${item.name}`} items={menuItems} />
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function InlineAdd({
  name,
  amount,
  extra,
  extraLabel,
  namePlaceholder,
  amountPlaceholder,
  submitLabel,
  collapsedLabel,
  open,
  scrollOnOpen = true,
  onOpen,
  onClose,
  busy = false,
  onName,
  onAmount,
  onExtra,
  onSubmit,
}: {
  name: string;
  amount: string;
  extra: string;
  extraLabel: string;
  namePlaceholder: string;
  amountPlaceholder: string;
  submitLabel: string;
  collapsedLabel: string;
  open: boolean;
  scrollOnOpen?: boolean;
  onOpen: () => void;
  onClose: () => void;
  busy?: boolean;
  onName: (v: string) => void;
  onAmount: (v: string) => void;
  onExtra: (v: string) => void;
  onSubmit: () => void;
}) {
  const disabled = busy || !name.trim() || !amount.trim() || !String(extra).trim();
  const submitRowRef = useRef<HTMLDivElement>(null);
  const [fieldsMounted, setFieldsMounted] = useState(open);
  if (open && !fieldsMounted) {
    setFieldsMounted(true);
  }
  // Button and fields never share a frame — even on the first open paint.
  const showFields = open || fieldsMounted;

  useEffect(() => {
    if (!open || !scrollOnOpen) return;
    const node = submitRowRef.current;
    if (!node) return;
    const id = window.setTimeout(() => {
      node.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }, 220);
    return () => window.clearTimeout(id);
  }, [open, scrollOnOpen]);

  useEffect(() => {
    if (open || !fieldsMounted) return;
    const id = window.setTimeout(() => setFieldsMounted(false), 280);
    return () => window.clearTimeout(id);
  }, [open, fieldsMounted]);

  return (
    <div
      className={`mt-auto border-t border-[var(--numa-border)] pt-4 ${
        open
          ? "pb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+1.75rem)] md:pb-0"
          : ""
      }`}
    >
      {showFields ? (
        <div
          className={`numa-expand ${open ? "is-open" : ""}`}
          onTransitionEnd={(event) => {
            if (event.propertyName !== "grid-template-rows") return;
            if (!open) setFieldsMounted(false);
          }}
        >
          <div className="numa-expand-inner space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(9.5rem,11rem)]">
              <input
                value={name}
                onChange={(e) => onName(e.target.value)}
                placeholder={namePlaceholder}
                className="min-h-11 min-w-0 rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
              />
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => onAmount(e.target.value)}
                placeholder={amountPlaceholder}
                className="money min-h-11 min-w-0 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
              />
              <PlanDateField value={extra} onChange={onExtra} ariaLabel={extraLabel} />
            </div>
            <div
              ref={submitRowRef}
              className="flex scroll-mb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+var(--numa-safe-bottom)+0.75rem)] gap-2 md:scroll-mb-0"
            >
              <button
                type="button"
                disabled={disabled}
                className="numa-btn numa-btn-soft min-w-0 flex-1"
                onClick={onSubmit}
              >
                {busy ? "Sparar…" : submitLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                className="numa-press min-h-12 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                onClick={onClose}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="numa-btn numa-btn-soft w-full" onClick={onOpen}>
          {collapsedLabel}
        </button>
      )}
    </div>
  );
}

function MonthChipStrip({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    function sync() {
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 2) {
        setOverflow({ start: false, end: false });
        return;
      }
      setOverflow({
        start: el.scrollLeft > 2,
        end: el.scrollLeft < max - 2,
      });
    }

    sync();
    node.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  const fade =
    overflow.start && overflow.end
      ? "is-overflow-start is-overflow-end"
      : overflow.start
        ? "is-overflow-start"
        : overflow.end
          ? "is-overflow-end"
          : "";

  return (
    <div ref={scrollerRef} className={`numa-month-strip pb-1 ${fade}`.trim()}>
      {children}
    </div>
  );
}
