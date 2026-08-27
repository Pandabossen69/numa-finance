"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
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
  projectCashCoverage,
  projectExtraSaldoSeries,
  projectPlanForMonth,
  yearFromMonthKey,
  visibleMonthKeysForYear,
} from "@/domain/finance";
import { parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";
import { PlanPiles } from "@/components/plan/PlanPiles";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { SV } from "@/features/copy/labels-sv";
import { lastPlanView, rememberPlanView } from "@/features/home/last-snapshot";
import { useValueForKey } from "@/lib/hooks/use-value-for-key";
import { refreshQuiet } from "@/lib/nav/instant";
import {
  applyMonthSavings,
  isTempPlanId,
  stampPlanItems,
  mergeReturnedItem,
  mergeReturnedItems,
  optimisticPlanItem,
  removeItemById,
  replaceItemById,
  revertMonthSavings,
} from "@/features/plan/optimistic";
import type { ActionResult } from "@/features/plan/actions";
import {
  createPlanExtraAction,
  createPlanIncomeAction,
  createPlanItemAction,
  deletePlanItemAction,
  importFixedExpensesFromPreviousMonthAction,
  setMonthSavingsAction,
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
  | `delete:${string}`;

function minorToUi(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
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

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // InvalidStateError when the input is not rendered — fall through.
  }
  input.focus();
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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative min-h-11 min-w-0">
      {/*
        The native input sits behind the button (pointer-events: none) so it can
        still anchor showPicker. Do not call preventDefault or stretch the
        calendar-picker-indicator — both stop Chromium from writing the clicked
        day back to input.value (keyboard still worked; tap did not).
      */}
      <input
        ref={inputRef}
        type="date"
        lang="sv-SE"
        value={value}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => commitCalendarDate(e.target.value, value, onChange)}
        onInput={(e) =>
          commitCalendarDate(
            (e.target as HTMLInputElement).value,
            value,
            onChange,
          )
        }
        className="numa-date-input"
      />
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => openNativeDatePicker(inputRef.current)}
        className="relative z-10 flex min-h-11 w-full cursor-pointer items-center rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-left text-sm"
      >
        <span className={value ? "font-medium" : "text-[var(--numa-faint)]"}>
          {value ? formatIsoDateOnlySv(value) : "ÅÅÅÅ-MM-DD"}
        </span>
      </button>
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
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
  bankBalanceMinor?: number | null;
  spendingByMonthKey?: Record<string, number>;
  ledgerTransactions?: CanonicalTransaction[];
  focusAdd?: null | "income" | "fixed";
}) {
  const router = useRouter();
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
  const [expenseDay, setExpenseDay] = useState("1");
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDay, setEditDay] = useState("1");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [addKind, setAddKind] = useState<null | "income" | "fixed" | "extra">(
    focusAdd,
  );
  if (!busy && incomingStamp !== itemsStamp) {
    setItemsStamp(incomingStamp);
    if (items.length > 0 || localItems.length === 0) {
      setLocalItems(items);
    }
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
  const [dateMonthKey, setDateMonthKey] = useState(monthKey);
  if (dateMonthKey !== monthKey) {
    setDateMonthKey(monthKey);
    setIncomeDate((prev) =>
      prev.startsWith(monthKey) ? prev : `${monthKey}-25`,
    );
    setExtraDate((prev) =>
      prev.startsWith(monthKey) ? prev : `${monthKey}-15`,
    );
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
    setAddKind(null);
  }

  async function runMutation(opts: {
    busy: BusyKey;
    apply: (items: PlanItem[]) => PlanItem[];
    revert: (items: PlanItem[]) => PlanItem[];
    action: () => Promise<ActionResult>;
    reconcile?: (items: PlanItem[], result: Extract<ActionResult, { ok: true }>) => PlanItem[];
  }): Promise<boolean> {
    setError(null);
    setBusy(opts.busy);
    setLocalItems(opts.apply);
    try {
      const result = await opts.action();
      if (!result.ok) {
        setLocalItems(opts.revert);
        setError(result.error);
        return false;
      }
      setLocalItems((current) => {
        if (opts.reconcile) return opts.reconcile(current, result);
        if (result.item) return mergeReturnedItem(current, result.item);
        if (result.items) {
          return mergeReturnedItems(current, result.items, new Set());
        }
        return current;
      });
      startTransition(() => {
        refreshQuiet(router);
      });
      return true;
    } catch (err) {
      setLocalItems(opts.revert);
      setError(err instanceof Error ? err.message : "Något gick fel");
      return false;
    } finally {
      setBusy((current) => (current === opts.busy ? null : current));
    }
  }

  function startEditIncome(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDate(isoToDateInput(item.nextDueAt, timeZone));
  }

  function startEditExpense(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDay(item.nextDueAt ? String(dayOfMonthFromIso(item.nextDueAt)) : "1");
  }

  function startEditExtra(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDate(isoToDateInput(item.nextDueAt, timeZone));
  }

  function saveEditedItem(id: string, patch: Partial<PlanItem>) {
    const previous = localItems.find((row) => row.id === id);
    if (!previous) return;
    const next: PlanItem = {
      ...previous,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    void runMutation({
      busy: `edit:${id}`,
      apply: (rows) => replaceItemById(rows, id, next),
      revert: (rows) => replaceItemById(rows, id, previous),
      action: () =>
        updatePlanItemAction({
          id,
          name: next.name,
          amount: editAmount,
          date: next.nextDueAt
            ? isoToDateInput(next.nextDueAt, timeZone) || undefined
            : undefined,
        }),
      reconcile: (rows, result) =>
        result.item ? mergeReturnedItem(rows, result.item) : rows,
    }).then((ok) => {
      if (ok) setEditingId(null);
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftYear(-1)}
              className="numa-press min-h-10 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-white"
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
              className="numa-press min-h-10 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-white"
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
              Bläddra månad för månad — även år framåt
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
                    ? "is-active bg-[var(--numa-ink)] text-white shadow-[0_6px_16px_rgba(7,21,17,0.18)]"
                    : key === currentMonthKey
                      ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)] ring-1 ring-[var(--numa-accent)]/35"
                      : "bg-white text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-accent-ink)]"
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
                result.item
                  ? mergeReturnedItem(rows, result.item, tempId)
                  : rows,
            });
          }}
          onClearSavings={() => {
            let previous: PlanItem | null = null;
            void runMutation({
              busy: "savings-clear",
              apply: (rows) => {
                const applied = applyMonthSavings(
                  rows,
                  monthKey,
                  0,
                  currency,
                  timeZone,
                );
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
            <p className="text-[11px] font-medium text-[var(--numa-faint)]">
              {SV.intakter}
            </p>
            <div className="mt-1.5 text-[var(--numa-positive)]">
              <MoneyDisplay
                amountMinor={projection.incomeMinor}
                currency={currency}
                size="md"
                compact
                align="start"
              />
            </div>
          </div>
          <div className="numa-split-rule" aria-hidden />
          <div>
            <p className="text-[11px] font-medium text-[var(--numa-faint)]">
              {SV.utgifter}
            </p>
            <div className="mt-1.5 text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={projection.fixedMinor + projection.extraMinor}
                currency={currency}
                size="md"
                compact
                align="start"
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

      <div className="grid gap-4">
        <PlanCard
          title="Intäkter"
          totalLabel="Summa"
          totalMinor={projection.incomeMinor}
          currency={currency}
        >
          <PlanRows
            items={projection.incomes}
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDate}
            editExtraType="date"
            emptyHint="Lägg in lön eller CSN."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            pendingId={
              busy?.startsWith("edit:") || busy?.startsWith("delete:")
                ? busy.slice(busy.indexOf(":") + 1)
                : null
            }
            pendingAction={
              busy?.startsWith("edit:")
                ? "save"
                : busy?.startsWith("delete:")
                  ? "delete"
                  : null
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditIncome}
            onCancelEdit={() => setEditingId(null)}
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
            extraType="date"
            extraLabel="Datum"
            namePlaceholder="t.ex. Lön, Trukks, CSN"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till intäkt"
            collapsedLabel="Lägg till intäkt"
            open={addKind === "income"}
            onOpen={() => setAddKind("income")}
            onClose={() => setAddKind(null)}
            busy={busy === "add-income"}
            onName={setIncomeName}
            onAmount={setIncomeAmount}
            onExtra={setIncomeDate}
            onSubmit={() => {
              const parsed = parsePlanAmount(incomeAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              const created = optimisticPlanItem({
                name: incomeName,
                kind: "expected",
                amountMinor: parsed,
                currency,
                cadence: "income",
                nextDueAt: `${incomeDate}T12:00:00.000Z`,
                userId: ownerId,
              });
              const name = incomeName;
              const amount = incomeAmount;
              const date = incomeDate;
              setIncomeName("");
              setIncomeAmount("");
              void runMutation({
                busy: "add-income",
                apply: (rows) => [...rows, created],
                revert: (rows) => removeItemById(rows, created.id),
                action: () =>
                  createPlanIncomeAction({
                    name,
                    amount,
                    date,
                  }),
                reconcile: (rows, result) =>
                  result.item
                    ? mergeReturnedItem(rows, result.item, created.id)
                    : rows,
              }).then((ok) => {
                if (!ok) {
                  setIncomeName(name);
                  setIncomeAmount(amount);
                } else {
                  setAddKind(null);
                }
              });
            }}
          />
        </PlanCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Fasta utgifter"
          hint={
            isPastMonth
              ? "Låst — passerad månad ändras inte."
              : "Gäller bara den här månaden."
          }
          totalLabel="Summa"
          totalMinor={projection.fixedMinor}
          currency={currency}
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
                    result.items
                      ? mergeReturnedItems(rows, result.items, tempIds)
                      : rows,
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
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDay}
            editExtraType="day"
            locked={isPastMonth}
            emptyHint={
              isPastMonth
                ? "Inga fasta utgifter den här månaden."
                : canImportFixed
                  ? `Läs in från ${labelMonthNameSv(previousMonthKey)}, eller lägg till nya.`
                  : "Hyra och räkningar du måste betala."
            }
            subtitle={(item) =>
              item.nextDueAt
                ? formatListDateSv(item.nextDueAt, timeZone)
                : "Datum saknas"
            }
            pendingId={
              busy?.startsWith("edit:") || busy?.startsWith("delete:")
                ? busy.slice(busy.indexOf(":") + 1)
                : null
            }
            pendingAction={
              busy?.startsWith("edit:")
                ? "save"
                : busy?.startsWith("delete:")
                  ? "delete"
                  : null
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDay}
            onStartEdit={startEditExpense}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              const parsed = parsePlanAmount(editAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              const day = Number(editDay);
              saveEditedItem(id, {
                name: editName.trim(),
                amountMinor: parsed,
                nextDueAt: dueDateInMonth(
                  monthKey,
                  Number.isFinite(day) ? day : 1,
                ),
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

          {isPastMonth ? null : (
            <InlineAdd
              name={expenseName}
              amount={expenseAmount}
              extra={expenseDay}
              extraType="day"
              extraLabel="Dag"
              namePlaceholder="t.ex. Hyra, El, Netflix"
              amountPlaceholder={`Belopp (${currency})`}
              submitLabel="Lägg till fast utgift"
              collapsedLabel="Lägg till fast utgift"
              open={addKind === "fixed"}
              onOpen={() => setAddKind("fixed")}
              onClose={() => setAddKind(null)}
              busy={busy === "add-fixed"}
              onName={setExpenseName}
              onAmount={setExpenseAmount}
              onExtra={setExpenseDay}
              onSubmit={() => {
                const parsed = parsePlanAmount(expenseAmount);
                if (typeof parsed !== "number") {
                  setError(parsed.error);
                  return;
                }
                const day = Number(expenseDay);
                const created = optimisticPlanItem({
                  name: expenseName,
                  kind: "mandatory",
                  amountMinor: parsed,
                  currency,
                  cadence: "monthly",
                  nextDueAt: dueDateInMonth(
                    monthKey,
                    Number.isFinite(day) ? day : 1,
                  ),
                  userId: ownerId,
                });
                const name = expenseName;
                const amount = expenseAmount;
                setExpenseName("");
                setExpenseAmount("");
                void runMutation({
                  busy: "add-fixed",
                  apply: (rows) => [...rows, created],
                  revert: (rows) => removeItemById(rows, created.id),
                  action: () =>
                    createPlanItemAction({
                      name,
                      kind: "mandatory",
                      amount,
                      dayOfMonth: Number.isFinite(day) ? day : 1,
                      monthKey,
                    }),
                  reconcile: (rows, result) =>
                    result.item
                      ? mergeReturnedItem(rows, result.item, created.id)
                      : rows,
                }).then((ok) => {
                  if (!ok) {
                    setExpenseName(name);
                    setExpenseAmount(amount);
                  } else {
                    setAddKind(null);
                  }
                });
              }}
            />
          )}
        </PlanCard>

        <PlanCard
          title="Extra utgifter"
          totalLabel="Summa"
          totalMinor={projection.extraMinor}
          currency={currency}
        >
          <PlanRows
            items={projection.extraItems}
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDate}
            editExtraType="date"
            emptyHint="En räkning som bara kommer en gång."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            pendingId={
              busy?.startsWith("edit:") || busy?.startsWith("delete:")
                ? busy.slice(busy.indexOf(":") + 1)
                : null
            }
            pendingAction={
              busy?.startsWith("edit:")
                ? "save"
                : busy?.startsWith("delete:")
                  ? "delete"
                  : null
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditExtra}
            onCancelEdit={() => setEditingId(null)}
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
            extraType="date"
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
              const parsed = parsePlanAmount(extraAmount);
              if (typeof parsed !== "number") {
                setError(parsed.error);
                return;
              }
              const created = optimisticPlanItem({
                name: extraName,
                kind: "expected",
                amountMinor: parsed,
                currency,
                cadence: "once",
                nextDueAt: `${extraDate}T12:00:00.000Z`,
                userId: ownerId,
              });
              const name = extraName;
              const amount = extraAmount;
              const date = extraDate;
              setExtraName("");
              setExtraAmount("");
              void runMutation({
                busy: "add-extra",
                apply: (rows) => [...rows, created],
                revert: (rows) => removeItemById(rows, created.id),
                action: () =>
                  createPlanExtraAction({
                    name,
                    amount,
                    date,
                  }),
                reconcile: (rows, result) =>
                  result.item
                    ? mergeReturnedItem(rows, result.item, created.id)
                    : rows,
              }).then((ok) => {
                if (!ok) {
                  setExtraName(name);
                  setExtraAmount(amount);
                } else {
                  setAddKind(null);
                }
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
  totalLabel,
  totalMinor,
  currency,
  children,
}: {
  title: string;
  hint?: string;
  totalLabel: string;
  totalMinor: number;
  currency: CurrencyCode;
  children: ReactNode;
}) {
  return (
    <section className="numa-panel flex flex-col gap-4 p-5">
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
              size="sm"
              compact
              align="end"
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
  currency,
  editingId,
  editName,
  editAmount,
  editExtra,
  editExtraType,
  emptyHint = "Inget här ännu.",
  locked = false,
  subtitle,
  pendingId = null,
  pendingAction = null,
  onEditName,
  onEditAmount,
  onEditExtra,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  editingId: string | null;
  editName: string;
  editAmount: string;
  editExtra: string;
  editExtraType: "date" | "day";
  emptyHint?: string;
  locked?: boolean;
  subtitle: (item: PlanItem) => string;
  pendingId?: string | null;
  pendingAction?: "save" | "delete" | null;
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

  return (
    <ul className="divide-y divide-[var(--numa-border)]">
      {items.map((item) =>
        editingId === item.id ? (
          <li key={item.id} className="space-y-3 py-3 first:pt-0">
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
              {editExtraType === "date" ? (
                <PlanDateField
                  value={editExtra}
                  onChange={onEditExtra}
                  ariaLabel="Datum"
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={editExtra}
                  onChange={(e) => onEditExtra(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm"
                  aria-label="Dag i månaden"
                />
              )}
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
        ) : (
          <li
            key={item.id}
            className="flex items-start justify-between gap-x-3 gap-y-2 py-3 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <p
                className="break-words font-medium leading-snug [overflow-wrap:anywhere]"
                title={item.name}
              >
                {item.name}
              </p>
              <p className="text-xs text-[var(--numa-faint)]">{subtitle(item)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 max-w-[9.5rem] text-[var(--numa-ink)] sm:max-w-none">
                <MoneyDisplay
                  amountMinor={item.amountMinor}
                  currency={(item.currency || currency) as CurrencyCode}
                  size="sm"
                  compact
                  align="end"
                />
              </span>
              {locked || isTempPlanId(item.id) ? null : confirmId === item.id ? (
                <div className="flex items-center gap-1">
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
                <OverflowMenu
                  label={`Åtgärder för ${item.name}`}
                  items={[
                    {
                      label: "Redigera",
                      onSelect: () => {
                        setConfirmId(null);
                        onStartEdit(item);
                      },
                    },
                    {
                      label: "Ta bort",
                      tone: "danger",
                      disabled:
                        pendingId === item.id && pendingAction === "delete",
                      onSelect: () => setConfirmId(item.id),
                    },
                  ]}
                />
              )}
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

function InlineAdd({
  name,
  amount,
  extra,
  extraType,
  extraLabel,
  namePlaceholder,
  amountPlaceholder,
  submitLabel,
  collapsedLabel,
  open,
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
  extraType: "date" | "day";
  extraLabel: string;
  namePlaceholder: string;
  amountPlaceholder: string;
  submitLabel: string;
  collapsedLabel: string;
  open: boolean;
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
    if (!open) return;
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
  }, [open]);

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
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem]">
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
        {extraType === "date" ? (
          <PlanDateField
            value={extra}
            onChange={onExtra}
            ariaLabel={extraLabel}
          />
        ) : (
          <input
            type="number"
            min={1}
            max={31}
            value={extra}
            onChange={(e) => onExtra(e.target.value)}
            aria-label={extraLabel}
            placeholder="Dag"
            className="min-h-11 min-w-0 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          />
        )}
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
        <button
          type="button"
          className="numa-btn numa-btn-soft w-full"
          onClick={onOpen}
        >
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
    <div
      ref={scrollerRef}
      className={`numa-month-strip pb-1 ${fade}`.trim()}
    >
      {children}
    </div>
  );
}
