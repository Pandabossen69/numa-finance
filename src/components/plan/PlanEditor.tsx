"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import {
  addMonthsKey,
  dayOfMonthFromIso,
  dueDateInMonth,
  formatListDateSv,
  isoToDateInput,
  labelMonthNameSv,
  monthKeyFromDate,
  applyPlanItemEdits,
  previewPlanSettleEffect,
  planAmountBelowSettledError,
  resolveAdditionalSettlement,
  projectExtraSaldoSeries,
  savingsByMonthKeys,
  settledAmountMinor,
  sumCountsTowardCashMinor,
  yearFromMonthKey,
  visibleMonthKeysForYear,
  planWriteUserError,
} from "@/domain/finance";
import { offlineSaveMessage } from "@/lib/net/offline-save";
import { serverBlank, serverNull, serverZero } from "@/lib/react/server-snapshot";
import type { CurrencyCode } from "@/domain/money";
import { PlanPiles } from "@/components/plan/PlanPiles";
import {
  applyAccountDelta,
  applyOptimisticPlanSettle,
  adoptMutationFinance,
  adoptAccountsLastKnown,
  paintableAccountsSnapshot,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastPlanView,
  rememberPlanView,
  subscribeAccountsSnapshot,
  subscribeHomeSnapshot,
  subscribePlanView,
} from "@/features/home/last-snapshot";
import { newClientMutationId, thbToNativeMinor } from "@/domain/finance";
import { rememberLivePlan } from "@/components/plan/plan-cache";
import { invalidateSettledHomeSurfaces } from "@/features/home/invalidate-settled-home";
import {
  ensurePlanMonthPaint,
  ensurePlanMonthSuggestions,
  planMonthPaintEpoch,
  planMonthPaintStamp,
  planMonthSuggestionEpoch,
  readPlanMonthSuggestions,
  resolvePlanMonthPaint,
  scheduleEnsurePlanMonthPaint,
  scheduleEnsurePlanMonthSuggestions,
  schedulePrefetchAdjacentPlanMonths,
  softSwitchPlanMonth,
  subscribePlanMonthPaints,
  subscribePlanMonthSuggestions,
} from "@/features/plan/plan-month-cache";
import {
  adoptServerPlanItems,
  applyMonthSavings,
  clearDeletedPlanItemTombstone,
  insertItemAt,
  isTempPlanId,
  stampPlanItems,
  mergeReturnedItem,
  mergeReturnedItems,
  optimisticPlanItem,
  removeItemById,
  replaceItemById,
  revertMonthSavings,
  settlePlanItem,
  tombstoneDeletedPlanItem,
} from "@/features/plan/optimistic";
import type { PlanEditDraft, PlanPartialDraft } from "@/components/plan/PlanRowForms";
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
  accounts = null,
  focusAdd = null,
  stepHint = null,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
  bankBalanceMinor?: number | null;
  spendingByMonthKey?: Record<string, number>;
  ledgerTransactions?: CanonicalTransaction[];
  accounts?: import("@/features/finance/load-accounts").AccountsSnapshot | null;
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
    serverNull,
  );
  const coverageSaldoMinor = liveSaldoMinor ?? bankBalanceMinor;
  const sharedMonth = useSyncExternalStore(
    subscribePlanView,
    lastPlanView,
    serverNull,
  );
  const monthKey = sharedMonth?.monthKey ?? currentMonthKey;
  const viewYear = sharedMonth?.viewYear ?? yearFromMonthKey(currentMonthKey);
  // Publish the civil month once when nothing is remembered yet. Writing
  // during render would update Analys while Plan is still rendering.
  useEffect(() => {
    if (lastPlanView()) return;
    rememberPlanView({
      monthKey: currentMonthKey,
      viewYear: yearFromMonthKey(currentMonthKey),
    });
  }, [currentMonthKey]);
  const [localItems, setLocalItems] = useState(items);
  const monthKeys = useMemo(() => visibleMonthKeysForYear(viewYear), [viewYear]);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [partialId, setPartialId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey>(null);
  const viewItems = useMemo(
    () => (busy ? localItems : adoptServerPlanItems(localItems, items)),
    [busy, localItems, items],
  );
  const ownerId = viewItems[0]?.userId ?? items[0]?.userId ?? "";
  /** Sync lock: React busy state alone cannot stop a double-tap before re-render. */
  const writeLockRef = useRef(false);
  /** Publish only after this instance mutated. Hidden copies must not echo mount rows. */
  const dirtyRef = useRef(false);
  const [addKind, setAddKind] = useState<null | "income" | "fixed" | "extra">(focusAdd);
  const [seenFocusAdd, setSeenFocusAdd] = useState(focusAdd);
  if (focusAdd !== seenFocusAdd) {
    setSeenFocusAdd(focusAdd);
    if (focusAdd) setAddKind(focusAdd);
  }
  const storedAccounts = useSyncExternalStore(
    subscribeAccountsSnapshot,
    paintableAccountsSnapshot,
    serverNull,
  );
  useEffect(() => {
    if (accounts) adoptAccountsLastKnown(accounts);
  }, [accounts]);
  const accountsView = storedAccounts ?? accounts;
  const settleAccounts = useMemo(
    () =>
      (accountsView?.accounts ?? []).map((account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency,
      })),
    [accountsView],
  );
  const defaultSettleAccountId =
    accountsView?.accounts.find((account) => account.isDefault)?.id ??
    accountsView?.accounts[0]?.id ??
    "";
  const [settleAccountId, setSettleAccountId] = useState(defaultSettleAccountId);
  const settleAccountIdOrDefault = settleAccountId || defaultSettleAccountId;
  const focusCardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!focusAdd) return;
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
    // After settle the store already has the canonical ledger + saldo.
    // Re-publishing the first-paint props would drop ledgerOrigin and
    // treat Hyra as Spenderat idag.
    const liveLedger = previous?.ledgerTransactions?.length
      ? previous.ledgerTransactions
      : ledgerTransactions;
    if (
      previous &&
      stampPlanItems(previous.items) === stampPlanItems(next) &&
      previous.currency === currency &&
      previous.timeZone === timeZone
    ) {
      return;
    }
    rememberLivePlan({
      items: next,
      currency,
      timeZone,
      // Prop saldo only as fallback — live coverage must not re-enter
      // this effect (that loop crashed Plan after Delvis settle).
      bankBalanceMinor: previous?.bankBalanceMinor ?? bankBalanceMinor,
      spendingByMonthKey,
      ledgerTransactions: liveLedger,
      accounts: previous?.accounts,
      financeRevision: previous?.financeRevision
        ? `${previous.financeRevision.replace(/:local$/, "")}:local`
        : `local:${Date.now()}`,
      verifiedAt: new Date().toISOString(),
      truthStatus: "stale",
    });
  }

  // Publish after commit, and only after a local mutation in this instance.
  // A hidden copy's mount rows must not overwrite a fresher server plan when
  // bankBalanceMinor or spendingByMonthKey change identity.
  // Writing to the plan store inside a setState updater ran during render
  // and updated PlanScreen mid-render, which React rejects and which could
  // repaint the list under the user's finger.
  // Do not depend on ledgerTransactions — Koppla updates that prop and
  // re-publishing adopted rows looped Plan ("Too many re-renders").
  // Do not depend on bankBalanceMinor — that loop crashed Plan after Delvis settle.
  useEffect(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    publishItems(localItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localItems]);

  const monthPaintInput = useMemo(
    () => ({
      items: viewItems,
      ledgerTransactions,
      monthKey,
      timeZone,
      saldoMinor: coverageSaldoMinor,
    }),
    [viewItems, ledgerTransactions, monthKey, timeZone, coverageSaldoMinor],
  );
  const monthPaintStamp = useMemo(
    () => planMonthPaintStamp(monthPaintInput),
    [monthPaintInput],
  );
  const paintEpoch = useSyncExternalStore(
    subscribePlanMonthPaints,
    planMonthPaintEpoch,
    serverZero,
  );
  void paintEpoch;
  // Same-month edits (add/settle/delete) build now so totals match the row.
  // A month switch keeps cached chrome. Catch up only once that paint is
  // ready — doing it sooner would sync-build the destination month.
  const [paintedMonth, setPaintedMonth] = useState(monthKey);
  const switchingMonth = paintedMonth !== monthKey;
  const monthPaintResolved = resolvePlanMonthPaint(
    monthPaintInput,
    monthPaintStamp,
    switchingMonth ? { allowBuild: false } : { allowBuild: true },
  );
  if (switchingMonth && monthPaintResolved.ready) {
    setPaintedMonth(monthKey);
  }
  const { paint: monthPaint, ready: monthReady } = monthPaintResolved;
  const { projection, coverage, importableFixed, linkedPlanIds } = monthPaint;
  const suggestionEpoch = useSyncExternalStore(
    subscribePlanMonthSuggestions,
    planMonthSuggestionEpoch,
    serverZero,
  );
  void suggestionEpoch;
  const linkSuggestions = monthReady
    ? (readPlanMonthSuggestions(monthKey, monthPaintStamp) ?? [])
    : [];
  const displayMonthKey = monthReady ? monthKey : monthPaint.monthKey;
  const previousMonthKey = addMonthsKey(displayMonthKey, -1);
  const displayIsPastMonth = displayMonthKey < currentMonthKey;
  const canImportFixed = !displayIsPastMonth && importableFixed.length > 0;
  useEffect(() => {
    scheduleEnsurePlanMonthPaint(monthPaintInput, monthPaintStamp);
    schedulePrefetchAdjacentPlanMonths(monthPaintInput, monthPaintStamp);
    scheduleEnsurePlanMonthSuggestions(
      monthPaintInput,
      monthPaintStamp,
      projection,
    );
    // Adjacent months share this stamp — rebuild only when money inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthPaintStamp, monthKey]);
  const savingsTotalMinor = coverage.reservedSavingsMinor;
  const monthName = labelMonthNameSv(displayMonthKey);
  const priorMonthName = labelMonthNameSv(addMonthsKey(displayMonthKey, -1));
  const yearThroughKey = monthKeys[monthKeys.length - 1] ?? monthKey;
  const yearExtra = useMemo(
    () =>
      projectExtraSaldoSeries({
        planItems: viewItems,
        spendingByMonthKey,
        throughMonthKey: yearThroughKey,
        currentMonthKey,
        timeZone,
      }),
    [viewItems, spendingByMonthKey, yearThroughKey, currentMonthKey, timeZone],
  );
  const extraByMonth = useMemo(() => {
    const out: Record<string, number> = {};
    for (const row of yearExtra) {
      out[row.monthKey] = row.monthResultMinor + row.carriedInMinor;
    }
    return out;
  }, [yearExtra]);
  const savingsByMonth = useMemo(
    () => savingsByMonthKeys(viewItems, monthKeys, timeZone),
    [viewItems, monthKeys, timeZone],
  );
  const homeLivingStamp = useSyncExternalStore(
    subscribeHomeSnapshot,
    () => {
      const home = lastHomeSnapshot();
      if (!home) return "";
      return `${home.remainingFreeMinor}:${home.dayBudgetMinor}:${home.cycleSpendingMinor}:${home.todaySpendingMinor}:${home.cycleIsActive}`;
    },
    serverBlank,
  );
  void homeLivingStamp;
  const home = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    serverNull,
  );
  const [incomeDate, setIncomeDate] = useState(`${monthKey}-25`);
  const [extraDate, setExtraDate] = useState(`${monthKey}-15`);
  const [expenseDate, setExpenseDate] = useState(`${monthKey}-01`);
  const incomeDateView = incomeDate.startsWith(monthKey)
    ? incomeDate
    : `${monthKey}-25`;
  const extraDateView = extraDate.startsWith(monthKey)
    ? extraDate
    : `${monthKey}-15`;
  const expenseDateView = expenseDate.startsWith(monthKey)
    ? expenseDate
    : `${monthKey}-01`;

  function selectMonth(key: string) {
    if (key === monthKey) return;
    // Chrome first — dest project used to block the pil (~326ms). Warm
    // cache hits still paint totals in this tick (Spec P).
    const nextInput = { ...monthPaintInput, monthKey: key };
    flushSync(() => {
      rememberPlanView({ monthKey: key, viewYear: yearFromMonthKey(key) });
      setEditingId(null);
      setPartialId(null);
      setAddKind(null);
    });
    softSwitchPlanMonth(nextInput, monthPaintStamp);
    schedulePrefetchAdjacentPlanMonths(nextInput, monthPaintStamp);
  }

  function prefetchMonth(key: string) {
    if (key === monthKey) return;
    const next = { ...monthPaintInput, monthKey: key };
    const paint = ensurePlanMonthPaint(next, monthPaintStamp);
    ensurePlanMonthSuggestions(next, monthPaintStamp, paint.projection);
  }

  const runMutation = useCallback(async (opts: {
    busy: BusyKey;
    apply: (items: PlanItem[]) => PlanItem[];
    revert: (items: PlanItem[]) => PlanItem[];
    action: () => Promise<ActionResult>;
    reconcile?: (
      items: PlanItem[],
      result: Extract<ActionResult, { ok: true }>,
    ) => PlanItem[];
  }): Promise<boolean> => {
    if (writeLockRef.current) return false;
    writeLockRef.current = true;
    const base = viewItems;
    setError(null);
    setBusy(opts.busy);
    dirtyRef.current = true;
    setLocalItems(opts.apply(base));
    try {
      const result = await opts.action();
      if (!result.ok) {
        dirtyRef.current = true;
        setLocalItems(opts.revert(base));
        setError(
          offlineSaveMessage(result.error) ??
            planWriteUserError(result.error, "Kunde inte spara planposten"),
        );
        return false;
      }
      dirtyRef.current = true;
      setLocalItems((current) => {
        const next = opts.reconcile
          ? opts.reconcile(current, result)
          : result.item
            ? mergeReturnedItem(current, result.item)
            : result.items
              ? mergeReturnedItems(current, result.items, new Set())
              : current;
        return next;
      });
      return true;
    } catch (err) {
      dirtyRef.current = true;
      setLocalItems(opts.revert(base));
      setError(
        offlineSaveMessage(err) ?? planWriteUserError(err, "Något gick fel"),
      );
      return false;
    } finally {
      writeLockRef.current = false;
      setBusy((current) => (current === opts.busy ? null : current));
    }
  }, [viewItems]);

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

  const settleRow = useCallback((
    id: string,
    settled: boolean,
    /** Cumulative settled total (absolute minor target as UI string), not "amount now". */
    targetSettledAmount?: string,
    remainingDate?: string,
  ) => {
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
    const previous = viewItems.find((row) => row.id === id);
    const targetBookedMinor = !settled
      ? 0
      : settledMinor != null
        ? settledMinor
        : (previous?.amountMinor ?? 0);
    const preview = previous
      ? previewPlanSettleEffect({
          item: previous,
          planItems: viewItems,
          targetBookedMinor,
          transactions: ledgerTransactions,
          timeZone,
        })
      : null;
    const settleAccount = accountsView?.accounts.find(
      (account) => account.id === settleAccountIdOrDefault,
    );
    const nativeSaldoDelta = (() => {
      if (!preview) return 0;
      if (!settleAccount || settleAccount.currency === "THB") {
        return preview.saldoDeltaMinor;
      }
      const sign = preview.saldoDeltaMinor < 0 ? -1 : 1;
      return (
        sign *
        thbToNativeMinor(
          Math.abs(preview.saldoDeltaMinor),
          settleAccount.currency,
          settleAccount.fxRate,
        )
      );
    })();
    if (preview) {
      applyAccountDelta(nativeSaldoDelta, settleAccountIdOrDefault);
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
          applyAccountDelta(-nativeSaldoDelta, settleAccountIdOrDefault);
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
          accountId: settleAccountIdOrDefault || undefined,
          clientMutationId: newClientMutationId(),
        }),
      reconcile: (rows, result) => {
        invalidateSettledHomeSurfaces();
        adoptMutationFinance(result);
        return result.item ? mergeReturnedItem(rows, result.item) : rows;
      },
    }).then((ok) => {
      if (ok) setPartialId(null);
    });
  }, [
    accountsView,
    ledgerTransactions,
    runMutation,
    settleAccountIdOrDefault,
    timeZone,
    viewItems,
  ]);

  const savePartialRow = useCallback((
    id: string,
    partialAmount: string,
    partialDate: string,
  ) => {
    const item = viewItems.find((row) => row.id === id);
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
  }, [settleRow, viewItems]);

  const markRemainder = useCallback((id: string) => {
    const item = viewItems.find((row) => row.id === id);
    if (!item) return;
    // Full Klar — omit target so the action settles the planned amount.
    settleRow(id, true);
  }, [settleRow, viewItems]);

  const startPartial = useCallback((item: PlanItem) => {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setEditingId(null);
    setPartialId(item.id);
  }, []);

  const rowPending = useMemo(() => {
    if (!busy || !busy.includes(":")) {
      return { pendingId: null, pendingAction: null } as const;
    }
    const id = busy.slice(busy.indexOf(":") + 1);
    if (busy.startsWith("edit:")) {
      return { pendingId: id, pendingAction: "save" as const };
    }
    if (busy.startsWith("delete:")) {
      return { pendingId: id, pendingAction: "delete" as const };
    }
    if (busy.startsWith("settle:")) {
      return { pendingId: id, pendingAction: "settle" as const };
    }
    return { pendingId: null, pendingAction: null } as const;
  }, [busy]);

  const startEdit = useCallback((item: PlanItem) => {
    if (isTempPlanId(item.id)) return;
    setAddKind(null);
    setPartialId(null);
    setEditingId(item.id);
  }, []);

  const saveEditedItem = useCallback((
    id: string,
    patch: Partial<PlanItem>,
    amountRaw: string,
  ) => {
    const previous = viewItems.find((row) => row.id === id);
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
          amount: amountRaw,
          date: pickedDate,
        }),
      reconcile: (rows, result) => {
        if (result.home || result.plan || result.refreshPending) {
          invalidateSettledHomeSurfaces();
          adoptMutationFinance(result);
        }
        return result.item ? mergeReturnedItem(rows, result.item) : rows;
      },
    }).then((ok) => {
      if (ok) setEditingId(null);
    });
  }, [runMutation, timeZone, viewItems]);

  const deleteRow = useCallback((id: string) => {
    const index = viewItems.findIndex((row) => row.id === id);
    const previous = index >= 0 ? viewItems[index] : undefined;
    if (!previous || index < 0) return;
    tombstoneDeletedPlanItem(id);
    void runMutation({
      busy: `delete:${id}`,
      apply: (rows) => removeItemById(rows, id),
      revert: (rows) => {
        clearDeletedPlanItemTombstone(id);
        return insertItemAt(rows, index, previous);
      },
      action: () => deletePlanItemAction(id),
    });
  }, [runMutation, viewItems]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setPartialId(null);
  }, []);
  const cancelPartial = useCallback(() => setPartialId(null), []);
  const saveEdit = useCallback((id: string, draft: PlanEditDraft) => {
    const parsed = parsePlanAmount(draft.amount);
    if (typeof parsed !== "number") {
      setError(parsed.error);
      return;
    }
    const current = viewItems.find((row) => row.id === id);
    if (current) {
      const below = planAmountBelowSettledError(current, parsed);
      if (below) {
        setError(below);
        return;
      }
    }
    saveEditedItem(id, {
      name: draft.name.trim(),
      amountMinor: parsed,
      nextDueAt: draft.date ? `${draft.date}T12:00:00.000Z` : null,
    }, draft.amount);
  }, [saveEditedItem, viewItems]);
  const savePartial = useCallback((id: string, draft: PlanPartialDraft) => {
    savePartialRow(id, draft.amount, draft.date);
  }, [savePartialRow]);
  const incomeSubtitle = useCallback(
    (item: PlanItem) => labelIncomeDateSv(item.nextDueAt, timeZone),
    [timeZone],
  );
  const fixedSubtitle = useCallback(
    (item: PlanItem) =>
      item.nextDueAt ? formatListDateSv(item.nextDueAt, timeZone) : "Datum saknas",
    [timeZone],
  );
  const saveSavings = useCallback((amount: string) => {
    const parsed = parsePlanAmount(amount.trim() === "" ? "0" : amount);
    if (typeof parsed !== "number") {
      setError(parsed.error);
      return;
    }
    let tempId: string | undefined;
    let previous: PlanItem | null = null;
    void runMutation({
      busy: "savings",
      apply: (rows) => {
        const applied = applyMonthSavings(rows, monthKey, parsed, currency, timeZone);
        tempId = applied.tempId;
        previous = applied.previous;
        return applied.items;
      },
      revert: (rows) =>
        revertMonthSavings(rows, monthKey, previous, tempId, timeZone),
      action: () =>
        setMonthSavingsAction({
          monthKey,
          amount: amount.trim() === "" ? "0" : amount,
        }),
      reconcile: (rows, result) => {
        adoptMutationFinance(result);
        if (result.plan) return result.plan.items;
        return result.item ? mergeReturnedItem(rows, result.item, tempId) : rows;
      },
    });
  }, [currency, monthKey, runMutation, timeZone]);
  const clearSavings = useCallback(() => {
    let previous: PlanItem | null = null;
    return runMutation({
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
      reconcile: (rows, result) => {
        adoptMutationFinance(result);
        if (result.plan) return result.plan.items;
        return rows;
      },
    });
  }, [currency, monthKey, runMutation, timeZone]);

  return (
    <div
      className="space-y-8"
      data-plan-month-key={monthKey}
      data-plan-month-ready={monthReady ? "1" : "0"}
    >
      <section className="animate-rise-delay-1 space-y-4">
        <PlanMonthNav
          monthKey={monthKey}
          viewYear={viewYear}
          currentMonthKey={currentMonthKey}
          onSelectMonth={selectMonth}
          onPrefetchMonth={prefetchMonth}
          dotsFor={(key) => ({
            living: (extraByMonth[key] ?? 0) > 0,
            save: (savingsByMonth[key] ?? 0) > 0,
          })}
        />

        <PlanPiles
          coverage={coverage}
          monthName={monthName}
          priorMonthName={priorMonthName}
          timeZone={timeZone}
          currency={currency}
          savingsTotalMinor={savingsTotalMinor}
          savingsThisMonthMinor={coverage.savingsThisMonthMinor}
          savingsPriorMinor={coverage.savingsPriorMinor}
          savingsByMonth={savingsByMonth}
          monthKeys={monthKeys}
          savingsSeed={
            projection.savingsMinor > 0 ? minorToUi(projection.savingsMinor) : ""
          }
          savingsResetKey={`${displayMonthKey}:${projection.savingsMinor}`}
          monthKey={monthKey}
          planItems={viewItems}
          savingsCurrentMinor={projection.savingsMinor}
          ledgerTransactions={ledgerTransactions}
          saldoMinor={coverageSaldoMinor}
          cycleSpendingMinor={home?.cycleSpendingMinor ?? 0}
          todaySpendingMinor={home?.todaySpendingMinor ?? 0}
          fundingConfirmed={home?.cycleIsActive}
          canPreview={monthReady}
          savingsBusy={busy === "savings"}
          clearBusy={busy === "savings-clear"}
          onSaveSavings={saveSavings}
          onClearSavings={clearSavings}
        />
      </section>

      {error && !partialId ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {linkSuggestions.length > 0 ? (
        <section className="space-y-2" aria-label="Förslag att koppla">
          <p className="px-1 text-sm font-semibold tracking-tight">Förslag</p>
          <p className="px-1 text-xs leading-snug text-[var(--numa-faint)]">
            Liknande belopp nära datumet. Koppla bara om det är rätt räkning — NUMA gissar
            inte åt dig.
          </p>
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {linkSuggestions.map((suggestion) => {
              const item = viewItems.find((row) => row.id === suggestion.planItemId);
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
                            clientMutationId: newClientMutationId(),
                          }),
                        reconcile: (rows, result) => {
                          adoptMutationFinance(result);
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
            timeZone={timeZone}
            monthKey={monthKey}
            editingId={editingId}
            emptyHint="Lägg in lön eller CSN."
            subtitle={incomeSubtitle}
            pendingId={rowPending.pendingId}
            pendingAction={rowPending.pendingAction}
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialPrompt="Hur mycket fick du nu?"
            remainingDatePrompt="När kommer resten?"
            onStartPartial={startPartial}
            onCancelPartial={cancelPartial}
            onSavePartial={savePartial}
            saveError={partialId ? error : null}
            settleAccounts={settleAccounts}
            settleAccountId={settleAccountIdOrDefault}
            onSettleAccountId={setSettleAccountId}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={deleteRow}
          />

          <InlineAdd
            name={incomeName}
            amount={incomeAmount}
            extra={incomeDateView}
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
                date: incomeDateView,
                item: {
                  kind: "expected",
                  cadence: "income",
                  nextDueAt: `${incomeDateView}T12:00:00.000Z`,
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
            timeZone={timeZone}
            monthKey={monthKey}
            editingId={editingId}
            emptyHint={
              canImportFixed
                ? `Läs in från ${labelMonthNameSv(previousMonthKey)}, eller lägg till nya.`
                : "Hyra och räkningar du måste betala."
            }
            subtitle={fixedSubtitle}
            pendingId={rowPending.pendingId}
            pendingAction={rowPending.pendingAction}
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialPrompt="Hur mycket betalade du nu?"
            remainingDatePrompt="När ska resten betalas?"
            onStartPartial={startPartial}
            onCancelPartial={cancelPartial}
            onSavePartial={savePartial}
            saveError={partialId ? error : null}
            settleAccounts={settleAccounts}
            settleAccountId={settleAccountIdOrDefault}
            onSettleAccountId={setSettleAccountId}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={deleteRow}
          />

          <InlineAdd
            name={expenseName}
            amount={expenseAmount}
            extra={expenseDateView}
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
                date: expenseDateView,
                item: {
                  kind: "mandatory",
                  cadence: "monthly",
                  nextDueAt: `${expenseDateView}T12:00:00.000Z`,
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
            timeZone={timeZone}
            monthKey={monthKey}
            editingId={editingId}
            emptyHint="En räkning som bara kommer en gång."
            subtitle={incomeSubtitle}
            pendingId={rowPending.pendingId}
            pendingAction={rowPending.pendingAction}
            onSettle={settleRow}
            onMarkRemainder={markRemainder}
            partialId={partialId}
            partialPrompt="Hur mycket betalade du nu?"
            remainingDatePrompt="När ska resten betalas?"
            onStartPartial={startPartial}
            onCancelPartial={cancelPartial}
            onSavePartial={savePartial}
            saveError={partialId ? error : null}
            settleAccounts={settleAccounts}
            settleAccountId={settleAccountIdOrDefault}
            onSettleAccountId={setSettleAccountId}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={deleteRow}
          />

          <InlineAdd
            name={extraName}
            amount={extraAmount}
            extra={extraDateView}
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
                date: extraDateView,
                item: {
                  kind: "expected",
                  cadence: "once",
                  nextDueAt: `${extraDateView}T12:00:00.000Z`,
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
