"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import {
  addMonthsKey,
  dayOfMonthFromIso,
  dueDateInMonth,
  importableFixedExpenses,
  formatListDateSv,
  isoToDateInput,
  labelMonthNameSv,
  monthKeyFromDate,
  cumulativePlanSavingsMinor,
  explicitlyLinkedPlanItemIds,
  suggestPlanLinks,
  applyPlanItemEdits,
  previewPlanSettleEffect,
  remainingOpenMinor,
  planAmountBelowSettledError,
  resolveAdditionalSettlement,
  projectCashCoverage,
  projectExtraSaldoSeries,
  projectPlanForMonth,
  remainingDueIso,
  settledAmountMinor,
  sumCountsTowardCashMinor,
  yearFromMonthKey,
  visibleMonthKeysForYear,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { PlanPiles } from "@/components/plan/PlanPiles";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { SV } from "@/features/copy/labels-sv";
import {
  applyAccountDelta,
  applyOptimisticPlanSettle,
  confirmOptimisticFinance,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastPlanView,
  rememberAccountsSnapshot,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
  rememberPlanView,
  subscribeHomeSnapshot,
  subscribePlanView,
} from "@/features/home/last-snapshot";
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
  confirmPlanLinkAction,
  setPlanItemSettledAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

import { PlanCard } from "@/components/plan/PlanCard";
import { PlanRows } from "@/components/plan/PlanRows";
import { InlineAdd } from "@/components/plan/InlineAdd";
import { PlanMonthNav } from "@/components/plan/PlanMonthNav";
import {
  labelIncomeDateSv,
  minorToUi,
  parsePlanAmount,
} from "@/components/plan/plan-format";

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
  | `settle:${string}`
  | `link:${string}`;

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
  const liveSaldoMinor = useSyncExternalStore(
    subscribeHomeSnapshot,
    () => lastHomeSnapshot()?.calculatedBalanceMinor ?? null,
    () => lastHomeSnapshot()?.calculatedBalanceMinor ?? null,
  );
  const coverageSaldoMinor = liveSaldoMinor ?? bankBalanceMinor;
  const [viewYear, setViewYear] = useState(() => {
    const remembered = lastPlanView();
    return remembered?.viewYear ?? yearFromMonthKey(currentMonthKey);
  });
  const [monthKey, setMonthKey] = useState(
    () => lastPlanView()?.monthKey ?? currentMonthKey,
  );
  // Published after commit: this store has subscribers now, and writing to it
  // during render would update Analys while Plan is still rendering.
  useEffect(() => {
    rememberPlanView({ monthKey, viewYear });
  }, [monthKey, viewYear]);

  // Analys can move the shared month while Plan sits mounted in the tab cache.
  useEffect(
    () =>
      subscribePlanView(() => {
        const shared = lastPlanView();
        if (!shared || shared.monthKey === monthKey) return;
        setMonthKey(shared.monthKey);
        setViewYear(shared.viewYear);
      }),
    [monthKey],
  );
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
  /** Sync lock: React busy state alone cannot stop a double-tap before re-render. */
  const writeLockRef = useRef(false);
  const [addKind, setAddKind] = useState<null | "income" | "fixed" | "extra">(focusAdd);
  const focusCardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!focusAdd) return;
    setAddKind(focusAdd);
    const id = window.setTimeout(() => {
      // "nearest" so a card already on screen does not yank the page.
      focusCardRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [focusAdd]);
  function publishItems(next: PlanItem[]) {
    const previous = lastPlanSnapshot();
    rememberLivePlan({
      items: next,
      currency,
      timeZone,
      // Prop saldo only — live coverage mirrors this publish and must not
      // re-enter the effect (that loop crashed Plan after Delvis settle).
      bankBalanceMinor,
      spendingByMonthKey,
      ledgerTransactions,
      financeRevision: previous?.financeRevision
        ? `${previous.financeRevision}:local`
        : `local:${Date.now()}`,
      verifiedAt: new Date().toISOString(),
      truthStatus: "stale",
    });
  }

  // Publish after commit. Writing to the plan store inside a setState
  // updater ran during render and updated PlanScreen mid-render, which React
  // rejects and which could repaint the list under the user's finger.
  useEffect(() => {
    publishItems(localItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localItems, currency, timeZone, bankBalanceMinor, spendingByMonthKey, ledgerTransactions]);

  // Adopt server/store props after commit — never during render.
  // Render-phase setState here raced PlanScreen's useSyncExternalStore when a
  // save finished (and previously when revalidatePath remounted /plan).
  useEffect(() => {
    if (busy) return;
    if (incomingStamp === itemsStamp) return;
    setLocalItems((current) => {
      const adopted = adoptServerPlanItems(current, items);
      const adoptedStamp = stampPlanItems(adopted);
      // Stamp what we keep — not raw incoming — so a merge that prefers
      // newer local rows cannot desync and re-trigger forever.
      setItemsStamp(adoptedStamp);
      if (adoptedStamp === stampPlanItems(current)) return current;
      return adopted;
    });
  }, [busy, incomingStamp, itemsStamp, items]);

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
        saldoMinor: coverageSaldoMinor,
      }),
    [localItems, ledgerTransactions, monthKey, timeZone, coverageSaldoMinor],
  );
  // Money only: keeps the card Summa in step with Hem's Kvar att betala so
  // cash already in the ledger is not counted twice. Never passed to the
  // rows — a match must not paint a chip or move a row.
  const linkedPlanIds = useMemo(
    () => explicitlyLinkedPlanItemIds(ledgerTransactions),
    [ledgerTransactions],
  );
  const linkSuggestions = useMemo(
    () => [
      ...suggestPlanLinks({
        items: projection.incomes,
        transactions: ledgerTransactions,
        kind: "income",
        monthKey,
        timeZone,
      }),
      ...suggestPlanLinks({
        items: projection.items,
        transactions: ledgerTransactions,
        kind: "expense",
        monthKey,
        timeZone,
      }),
    ],
    [projection.incomes, projection.items, ledgerTransactions, monthKey, timeZone],
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
    if (writeLockRef.current) return false;
    writeLockRef.current = true;
    setError(null);
    setBusy(opts.busy);
    setLocalItems((current) => {
      const next = opts.apply(current);
      return next;
    });
    try {
      const result = await opts.action();
      if (!result.ok) {
        setLocalItems((current) => {
          const next = opts.revert(current);
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
        // Keep stamp in step so adopting store props after unlock is a no-op.
        setItemsStamp(stampPlanItems(next));
        return next;
      });
      return true;
    } catch (err) {
      setLocalItems((current) => {
        const next = opts.revert(current);
        return next;
      });
      setError(err instanceof Error ? err.message : "Något gick fel");
      return false;
    } finally {
      writeLockRef.current = false;
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
    /** Cumulative settled total (absolute minor target as UI string), not "amount now". */
    targetSettledAmount?: string,
    remainingDate?: string,
  ) {
    if (isTempPlanId(id)) return;
    let settledMinor: number | null | undefined;
    let remainingDueAt: string | null | undefined;
    if (!settled) {
      settledMinor = null;
      remainingDueAt = null;
    } else if (targetSettledAmount != null) {
      const parsed = parsePlanAmount(targetSettledAmount);
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
    const targetBookedMinor = !settled
      ? 0
      : settledMinor != null
        ? settledMinor
        : (previous?.amountMinor ?? 0);
    const preview = previous
      ? previewPlanSettleEffect({
          item: previous,
          planItems: localItems,
          targetBookedMinor,
          transactions: ledgerTransactions,
          timeZone,
        })
      : null;
    if (preview) {
      applyAccountDelta(preview.saldoDeltaMinor);
      applyOptimisticPlanSettle({
        saldoDeltaMinor: preview.saldoDeltaMinor,
        incomingDeltaMinor: preview.incomingDeltaMinor,
        unpaidDeltaMinor: preview.unpaidDeltaMinor,
        cycleSpendingDeltaMinor:
          preview.kind === "expense" && !preview.skippedBecauseFunded
            ? -preview.saldoDeltaMinor
            : 0,
        todayPlannedPaidDeltaMinor:
          preview.kind === "expense" && !preview.skippedBecauseFunded
            ? -preview.saldoDeltaMinor
            : 0,
      });
    }
    void runMutation({
      busy: `settle:${id}`,
      apply: (rows) =>
        settlePlanItem(rows, id, { settled, settledMinor, remainingDueAt }),
      revert: (rows) => {
        if (preview) {
          applyAccountDelta(-preview.saldoDeltaMinor);
          applyOptimisticPlanSettle({
            saldoDeltaMinor: -preview.saldoDeltaMinor,
            incomingDeltaMinor: -preview.incomingDeltaMinor,
            unpaidDeltaMinor: -preview.unpaidDeltaMinor,
            cycleSpendingDeltaMinor:
              preview.kind === "expense" && !preview.skippedBecauseFunded
                ? preview.saldoDeltaMinor
                : 0,
            todayPlannedPaidDeltaMinor:
              preview.kind === "expense" && !preview.skippedBecauseFunded
                ? preview.saldoDeltaMinor
                : 0,
          });
        }
        return previous ? replaceItemById(rows, id, previous) : rows;
      },
      action: () =>
        setPlanItemSettledAction({
          id,
          settled,
          targetSettledAmount,
          remainingDate,
        }),
      reconcile: (rows, result) => {
        if (result.home) rememberHomeSnapshot(result.home);
        if (result.plan) rememberPlanSnapshot(result.plan);
        if (result.accounts) rememberAccountsSnapshot(result.accounts);
        confirmOptimisticFinance();
        return result.item ? mergeReturnedItem(rows, result.item) : rows;
      },
    }).then((ok) => {
      if (ok) {
        setPartialId(null);
        setPartialAmount("");
        setPartialDate("");
      }
    });
  }

  function savePartialRow(id: string) {
    const item = localItems.find((row) => row.id === id);
    if (!item) return;
    const parsed = parsePlanAmount(partialAmount);
    if (typeof parsed !== "number") {
      setError(parsed.error);
      return;
    }
    const resolved = resolveAdditionalSettlement({
      plannedMinor: item.amountMinor,
      alreadySettledMinor: settledAmountMinor(item),
      additionalMinor: parsed,
    });
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    if (!resolved.fullySettled && !partialDate.trim()) {
      setError("Ange datum för resten");
      return;
    }
    settleRow(
      id,
      true,
      minorToUi(resolved.targetSettledMinor),
      resolved.fullySettled ? undefined : partialDate,
    );
  }

  function markRemainder(id: string) {
    const item = localItems.find((row) => row.id === id);
    if (!item) return;
    // Full Klar — omit target so the action settles the planned amount.
    settleRow(id, true);
  }

  function startPartial(item: PlanItem) {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(null);
    setPartialId(item.id);
    // Additional amount for this step — not the cumulative settled total.
    setPartialAmount("");
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
        <PlanMonthNav
          monthKey={monthKey}
          viewYear={viewYear}
          currentMonthKey={currentMonthKey}
          onSelectMonth={selectMonth}
          onShiftYear={shiftYear}
          dotsFor={(key) => ({
            living: (extraByMonth[key] ?? 0) > 0,
            save: (savingsByMonth[key] ?? 0) > 0,
          })}
        />

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
      </section>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {linkSuggestions.length > 0 ? (
        <section className="space-y-2" aria-label="Förslag att koppla">
          <p className="px-1 text-sm font-semibold tracking-tight">Förslag</p>
          <p className="px-1 text-xs leading-snug text-[var(--numa-faint)]">
            Liknande belopp nära datumet. Koppla bara om det är rätt räkning —
            NUMA gissar inte åt dig.
          </p>
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {linkSuggestions.map((suggestion) => {
              const item = localItems.find((row) => row.id === suggestion.planItemId);
              const tx = ledgerTransactions.find(
                (row) => row.id === suggestion.transactionId,
              );
              if (!item || !tx) return null;
              return (
                <li
                  key={`${suggestion.planItemId}:${suggestion.transactionId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-[var(--numa-faint)]">
                      {tx.description || tx.merchant || "Rörelse"} ·{" "}
                      {(tx.amountMinor / 100).toLocaleString("sv-SE")} {tx.currency}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="numa-press shrink-0 rounded-full bg-[var(--numa-ink)] px-3 py-1.5 text-xs font-semibold text-[var(--numa-card)]"
                    aria-label={`Koppla ${item.name} till transaktionen`}
                    onClick={() => {
                      void runMutation({
                        busy: `link:${suggestion.planItemId}`,
                        apply: (rows) => rows,
                        revert: (rows) => rows,
                        action: () =>
                          confirmPlanLinkAction({
                            transactionId: suggestion.transactionId,
                            itemId: suggestion.planItemId,
                          }),
                        reconcile: (rows, result) => {
                          if (result.home) rememberHomeSnapshot(result.home);
                          if (result.plan) rememberPlanSnapshot(result.plan);
                          if (result.accounts) {
                            rememberAccountsSnapshot(result.accounts);
                          }
                          confirmOptimisticFinance();
                          return result.item
                            ? mergeReturnedItem(rows, result.item)
                            : rows;
                        },
                      });
                    }}
                  >
                    Koppla
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="animate-rise-delay-2 grid gap-4">
        <PlanCard
          title="Intäkter"
          totalLabel="Kvar att få"
          totalMinor={sumCountsTowardCashMinor(projection.incomes, linkedPlanIds)}
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
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket fick du nu?"
            remainingDatePrompt="När kommer resten?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => savePartialRow(id)}
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
              const current = localItems.find((row) => row.id === id);
              if (current) {
                const below = planAmountBelowSettledError(current, parsed);
                if (below) {
                  setError(below);
                  return;
                }
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
          totalLabel="Kvar att betala"
          totalMinor={sumCountsTowardCashMinor(projection.fixedItems, linkedPlanIds)}
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
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket betalade du nu?"
            remainingDatePrompt="När ska resten betalas?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => savePartialRow(id)}
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
              const current = localItems.find((row) => row.id === id);
              if (current) {
                const below = planAmountBelowSettledError(current, parsed);
                if (below) {
                  setError(below);
                  return;
                }
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
          totalLabel="Kvar att betala"
          totalMinor={sumCountsTowardCashMinor(projection.extraItems, linkedPlanIds)}
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
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialAmount={partialAmount}
            partialDate={partialDate}
            partialPrompt="Hur mycket betalade du nu?"
            remainingDatePrompt="När ska resten betalas?"
            onPartialAmount={setPartialAmount}
            onPartialDate={setPartialDate}
            onStartPartial={startPartial}
            onCancelPartial={() => setPartialId(null)}
            onSavePartial={(id) => savePartialRow(id)}
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
              const current = localItems.find((row) => row.id === id);
              if (current) {
                const below = planAmountBelowSettledError(current, parsed);
                if (below) {
                  setError(below);
                  return;
                }
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
