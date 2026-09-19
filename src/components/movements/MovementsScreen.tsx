"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import {
  updateTransactionAction,
  voidTransactionAction,
} from "@/features/finance/actions";
import { formatListDateSv, monthKeyFromDate } from "@/domain/finance";
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
  isMovementsDirty,
  lastAccountsSnapshot,
  lastAnalysSnapshot,
  lastHomeSnapshot,
  lastMovementsSnapshot,
  lastMovementsView,
  rememberMovementsSnapshot,
  rememberMovementsView,
  subscribeMovementsSnapshot,
  type MovementsFilter,
  type MovementsPeriod,
} from "@/features/home/last-snapshot";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import {
  matchesCategory,
  spendCategoryName,
  toggleCategory,
} from "./movements-category";

type Filter = MovementsFilter;
type Period = MovementsPeriod;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Alla" },
  { id: "expense", label: "Utgifter" },
  { id: "income", label: "Intäkter" },
  { id: "other", label: "Övrigt" },
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

function matchesFilter(
  tx: MovementsSnapshot["items"][number],
  filter: Filter,
): boolean {
  if (filter === "all") return true;
  if (filter === "expense") return tx.transactionType === "expense";
  if (filter === "income") return tx.transactionType === "income";
  return tx.transactionType !== "expense" && tx.transactionType !== "income";
}

function inMonthKey(iso: string, monthKey: string, timeZone: string): boolean {
  return monthKeyFromDate(new Date(iso), timeZone) === monthKey;
}

function minorToUi(amountMinor: number): string {
  return minorToUiAmount(amountMinor);
}

/** Page-shaped dest shell when RSC has not arrived and no last-known list. */
function pendingMovementsShell(): MovementsSnapshot {
  const home = lastHomeSnapshot();
  const analys = lastAnalysSnapshot();
  const timeZone = home?.timeZone ?? analys?.timeZone ?? "Asia/Bangkok";
  return {
    currency: home?.currency ?? analys?.currency ?? "THB",
    hasBankTruth: false,
    balanceMinor: null,
    monthIncomeMinor: 0,
    monthExpenseMinor: 0,
    monthNetMinor: 0,
    allIncomeMinor: 0,
    allExpenseMinor: 0,
    allNetMinor: 0,
    monthCategories: [],
    items: [],
    timeZone,
    monthKey: home?.monthKey ?? analys?.currentMonthKey ?? monthKeyFromDate(new Date(), timeZone),
  };
}

export function MovementsScreen({
  data,
  error,
}: {
  data: MovementsSnapshot | null;
  error?: string | null;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const rememberedView = lastMovementsView();
  const stored = useSyncExternalStore(
    subscribeMovementsSnapshot,
    lastMovementsSnapshot,
    lastMovementsSnapshot,
  );
  const [filter, setFilter] = useState<Filter>(
    () => rememberedView?.filter ?? "all",
  );
  const [period, setPeriod] = useState<Period>(
    () => rememberedView?.period ?? "month",
  );
  const [category, setCategory] = useState<string | null>(
    () => rememberedView?.category ?? null,
  );
  const listRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "void" | null>(
    null,
  );
  const actionLock = useRef(false);

  useEffect(() => {
    if (!confirmId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmId]);

  useEffect(() => {
    if (!data) return;
    const current = lastMovementsSnapshot();
    if (current == null || !isMovementsDirty()) {
      rememberMovementsSnapshot(data);
      return;
    }
    rememberMovementsSnapshot(mergeMovementNativeFromServer(current, data), {
      dirty: true,
    });
  }, [data]);

  rememberMovementsView({ filter, period, category });
  const view =
    stored ?? data ?? lastMovementsSnapshot() ?? (error ? null : pendingMovementsShell());

  const filtered = useMemo(() => {
    if (!view) return [];
    return view.items.filter((tx) => {
      if (!matchesFilter(tx, filter)) return false;
      if (!matchesCategory(tx.category, category)) return false;
      if (
        period === "month" &&
        !inMonthKey(tx.occurredAt, view.monthKey, view.timeZone)
      ) {
        return false;
      }
      return true;
    });
  }, [view, filter, period, category]);

  function selectCategory(name: string) {
    const next = toggleCategory(category, name);
    setCategory(next);
    if (next) {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!view) {
    return (
      <div className="space-y-2">
        <p className="font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <RetryLoadButton />
      </div>
    );
  }

  const income =
    period === "month" ? view.monthIncomeMinor : view.allIncomeMinor;
  const expense =
    period === "month" ? view.monthExpenseMinor : view.allExpenseMinor;
  const net = period === "month" ? view.monthNetMinor : view.allNetMinor;
  const maxCategory = view.monthCategories[0]?.amountMinor || 1;

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <header className="animate-rise">
        <h1 className="numa-page-title">Rörelser</h1>
      </header>

      <div className="numa-equal-chips animate-rise-delay-1">
        <PeriodChip
          active={period === "month"}
          onClick={() => setPeriod("month")}
          label="Denna månad"
        />
        <PeriodChip
          active={period === "all"}
          onClick={() => setPeriod("all")}
          label="All tid"
        />
      </div>

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
          tone="alarm"
        />
        <SummaryStat
          label="Netto"
          amountMinor={net}
          currency={view.currency}
          tone={net >= 0 ? "positive" : "alarm"}
          signed
        />
      </section>

      {view.hasBankTruth && view.balanceMinor != null ? (
        <section className="numa-money-stack animate-rise-delay-2 animate-scale-in">
          <MetricRow
            label="På kontona"
            amountMinor={view.balanceMinor}
            currency={view.currency}
          />
        </section>
      ) : null}

      {period === "month" && view.monthCategories.length > 0 ? (
        <section className="numa-panel animate-rise-delay-2 p-5">
          <h2 className="numa-section-title">Per kategori</h2>
          <p className="mt-1 text-xs leading-snug text-[var(--numa-faint)]">
            {category
              ? `Visar ${category}. Tryck igen för att visa alla.`
              : "Tryck på en kategori för att filtrera listan."}
          </p>
          <ul className="mt-4 space-y-2">
            {view.monthCategories.map((cat) => {
              const selected = category === cat.name;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={
                      selected
                        ? `Visa alla kategorier`
                        : `Visa ${cat.name}`
                    }
                    onClick={() => selectCategory(cat.name)}
                    className={`numa-press w-full min-h-11 min-w-0 rounded-2xl px-2.5 py-2 text-left ${
                      selected
                        ? "is-active bg-[var(--numa-bg)] ring-2 ring-[var(--numa-ink)]"
                        : "ring-1 ring-transparent hover:bg-[var(--numa-bg)]/55 hover:ring-[var(--numa-border-strong)]"
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
            onClick={() => setFilter(f.id)}
            className={`numa-press min-h-11 rounded-full px-3 text-sm font-semibold ${
              filter === f.id
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
            {category ? (
              <span className="font-medium text-[var(--numa-muted)]">
                {" "}
                · {category}
              </span>
            ) : null}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {category ? (
              <button
                type="button"
                onClick={() => setCategory(null)}
                className="numa-press numa-category-chip is-active max-w-[12ch] truncate min-h-11 rounded-full bg-[var(--numa-ink)] px-3 text-xs font-semibold text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
                aria-label="Visa alla kategorier"
              >
                {category}
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
            {view.items.length > 0 ? (
              <p className="text-sm text-[var(--numa-muted)]">
                Inga träffar för filtret — prova Alla, All tid eller en annan
                kategori.
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--numa-muted)]">
                  Inga rörelser här ännu.
                </p>
                <Link
                  href="/fota"
                  prefetch
                  onMouseEnter={() => prefetch("/fota")}
                  onFocus={() => prefetch("/fota")}
                  className="numa-btn numa-btn-accent inline-flex min-h-11 px-4"
                >
                  Lägg till
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {filtered.map((tx) => {
              const signed =
                tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              const canEdit =
                tx.transactionType === "expense" ||
                tx.transactionType === "income";

              if (editingId === tx.id) {
                const accountCurrency = lastAccountsSnapshot()?.accounts.find(
                  (account) => account.id === tx.accountId,
                )?.currency;
                const editPrefill = movementEditPrefill(tx, accountCurrency);
                return (
                  <li key={tx.id} className="space-y-3 px-4 py-3.5">
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
                            description =
                              sanitizeMoneyDescription(editDescription);
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
                          };
                          const nextCategory =
                            tx.transactionType === "expense"
                              ? editCategory || null
                              : undefined;
                          actionLock.current = true;
                          setPendingAction("save");
                          setActionError(null);
                          setEditingId(null);
                          applyMovementsEdit(tx.id, {
                            amountMinor,
                            nativeAmountMinor: amountMinor,
                            description,
                            category: nextCategory,
                          });
                          void (async () => {
                            try {
                              const result = await updateTransactionAction({
                                id: tx.id,
                                amount: editAmount,
                                description: editDescription,
                                category: nextCategory,
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
                  key={tx.id}
                  className="numa-money-line items-start px-4 py-3.5 transition-colors hover:bg-[var(--numa-bg)]/30"
                >
                  <div className="numa-money-line-label">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {sanitizeMoneyDescription(tx.description)}
                    </p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--numa-faint)]">
                      {filter === "all" ? (
                        <span>{typeLabel(tx.transactionType)}</span>
                      ) : null}
                      {filter === "all" || filter === "expense" ? (
                        <button
                          type="button"
                          aria-pressed={
                            category === spendCategoryName(tx.category)
                          }
                          aria-label={
                            category === spendCategoryName(tx.category)
                              ? `Visa alla kategorier`
                              : `Visa ${spendCategoryName(tx.category)}`
                          }
                          onClick={() =>
                            selectCategory(spendCategoryName(tx.category))
                          }
                          className={`numa-press numa-category-chip -my-1 inline-flex min-h-8 items-center rounded-full px-2 ${
                            category === spendCategoryName(tx.category)
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
                              void (async () => {
                                try {
                                  const result = await voidTransactionAction(
                                    tx.id,
                                  );
                                  if (!result.ok) {
                                    setActionError(result.error);
                                    return;
                                  }
                                  setConfirmId(null);
                                  applyMovementsVoid(tx.id);
                                  adoptMutationFinance(result);
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
                              const prefill = movementEditPrefill(
                                tx,
                                accountCurrency,
                              );
                              setEditingId(tx.id);
                              setConfirmId(null);
                              setEditAmount(minorToUi(prefill.amountMinor));
                              setEditDescription(tx.description);
                              setEditCategory(tx.category ?? "");
                              setActionError(null);
                            }}
                          >
                            Redigera
                          </button>
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs text-[var(--numa-muted)]"
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

function PeriodChip({
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
      onClick={onClick}
      className={`numa-press min-h-11 rounded-full px-3 text-sm font-semibold ${
        active
          ? "bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
          : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
      }`}
    >
      {label}
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
