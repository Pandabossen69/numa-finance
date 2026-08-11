"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  dayOfMonthFromIso,
  labelDayOfMonthSv,
  labelMonthNameSv,
  monthKeyFromDate,
  projectPayCycle,
  projectPlanForMonth,
  yearFromMonthKey,
  visibleMonthKeysForYear,
} from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import {
  createPlanExtraAction,
  createPlanIncomeAction,
  createPlanItemAction,
  deletePlanItemAction,
  setMonthSavingsAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

function minorToUi(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function labelIncomeDateSv(iso: string | null, timeZone: string): string {
  if (!iso) return "Datum saknas";
  return new Date(iso).toLocaleDateString("sv-SE", {
    timeZone,
    day: "numeric",
    month: "short",
  });
}

export function PlanEditor({
  items,
  currency,
  timeZone,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
}) {
  const router = useRouter();
  const currentMonthKey = useMemo(
    () => monthKeyFromDate(new Date(), timeZone),
    [timeZone],
  );
  const [viewYear, setViewYear] = useState(() =>
    yearFromMonthKey(currentMonthKey),
  );
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const monthKeys = useMemo(() => visibleMonthKeysForYear(viewYear), [viewYear]);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDay, setExpenseDay] = useState("1");
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDate, setExtraDate] = useState(`${currentMonthKey}-15`);
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(`${currentMonthKey}-25`);
  const [savingsAmount, setSavingsAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDay, setEditDay] = useState("1");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const projection = useMemo(
    () => projectPlanForMonth(items, monthKey, timeZone),
    [items, monthKey, timeZone],
  );

  const cycle = useMemo(
    () => projectPayCycle(items, new Date(), timeZone),
    [items, timeZone],
  );

  useEffect(() => {
    setSavingsAmount(
      projection.savingsMinor > 0 ? minorToUi(projection.savingsMinor) : "",
    );
  }, [monthKey, projection.savingsMinor]);

  useEffect(() => {
    setIncomeDate((prev) => {
      if (prev.startsWith(monthKey)) return prev;
      return `${monthKey}-25`;
    });
    setExtraDate((prev) => {
      if (prev.startsWith(monthKey)) return prev;
      return `${monthKey}-15`;
    });
  }, [monthKey]);

  function selectMonth(key: string) {
    setMonthKey(key);
    setViewYear(yearFromMonthKey(key));
    setEditingId(null);
  }

  function shiftYear(delta: number) {
    const nextYear = viewYear + delta;
    const keys = visibleMonthKeysForYear(nextYear);
    const preferred = `${nextYear}-${monthKey.slice(5)}`;
    const nextKey = keys.includes(preferred) ? preferred : keys[0]!;
    setViewYear(nextYear);
    setMonthKey(nextKey);
    setEditingId(null);
  }

  function refreshAfter(result: { ok: true } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  }

  function startEditIncome(item: PlanItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDate(isoToDateInput(item.nextDueAt));
  }

  function startEditExpense(item: PlanItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDay(
      item.nextDueAt ? String(dayOfMonthFromIso(item.nextDueAt)) : "1",
    );
  }

  function startEditExtra(item: PlanItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
    setEditDate(isoToDateInput(item.nextDueAt));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftYear(-1)}
              className="min-h-10 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] transition hover:bg-white/70"
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
              className="min-h-10 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] transition hover:bg-white/70"
              aria-label="Nästa år"
            >
              {viewYear + 1} →
            </button>
          </div>
          {monthKey !== currentMonthKey ? (
            <button
              type="button"
              onClick={() => selectMonth(currentMonthKey)}
              className="text-sm font-semibold text-[var(--numa-accent)]"
            >
              Denna månad
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {monthKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectMonth(key)}
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold capitalize transition ${
                monthKey === key
                  ? "bg-[var(--numa-ink)] text-white"
                  : key === currentMonthKey
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                    : "bg-white/60 text-[var(--numa-muted)] hover:bg-white"
              }`}
            >
              {labelMonthNameSv(key)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--numa-border)] pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
              {labelMonthNameSv(monthKey)}
            </p>
            <p
              className={`mt-1 text-2xl font-semibold tracking-tight ${
                projection.freeToSpendMinor >= 0
                  ? "text-[var(--numa-positive)]"
                  : "text-[var(--numa-danger)]"
              }`}
            >
              {formatMoney(money(projection.freeToSpendMinor, currency))}
            </p>
            <p className="mt-1 text-sm text-[var(--numa-muted)]">
              kvar efter fasta, extra och sparande
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--numa-muted)]">
            <span>
              In{" "}
              <span className="font-semibold text-[var(--numa-ink)]">
                {formatMoney(money(projection.incomeMinor, currency))}
              </span>
            </span>
            <span>
              Ut{" "}
              <span className="font-semibold text-[var(--numa-ink)]">
                {formatMoney(
                  money(projection.fixedMinor + projection.extraMinor, currency),
                )}
              </span>
            </span>
            <span>
              Sparar{" "}
              <span className="font-semibold text-[var(--numa-ink)]">
                {formatMoney(money(projection.savingsMinor, currency))}
              </span>
            </span>
          </div>
        </div>

        {cycle.startAt && monthKey === (cycle.fundingMonthKey ?? currentMonthKey) ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Hem: {cycle.startLabelSv} → {cycle.endLabelSv}
            {cycle.endInferred ? " · fyll i nästa månads intäkter för exakt slut" : ""}
            {" · "}
            <span className="font-semibold text-[var(--numa-ink)]">
              {formatMoney(money(cycle.perDayMinor, currency))}
            </span>
            {" / dag"}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-3">
            <span className="shrink-0 text-sm text-[var(--numa-muted)]">
              Spara denna månad
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={savingsAmount}
              onChange={(e) => setSavingsAmount(e.target.value)}
              placeholder="0"
              className="money min-h-11 w-full max-w-[10rem] rounded-xl border border-[var(--numa-border)] bg-white/80 px-3 text-sm font-semibold outline-none focus:border-[var(--numa-accent)]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  refreshAfter(
                    await setMonthSavingsAction({
                      monthKey,
                      amount: savingsAmount.trim() === "" ? "0" : savingsAmount,
                    }),
                  );
                });
              }}
              className="min-h-11 rounded-xl bg-[var(--numa-ink)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Spara
            </button>
            {projection.savingsMinor > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await setMonthSavingsAction({
                      monthKey,
                      amount: "0",
                    });
                    if (refreshAfter(result)) setSavingsAmount("");
                  });
                }}
                className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-white/70 disabled:opacity-50"
              >
                Nollställ
              </button>
            ) : null}
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
          hint="När pengarna kommer in"
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
            pending={pending}
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditIncome}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              startTransition(async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  date: editDate || undefined,
                });
                if (refreshAfter(result)) setEditingId(null);
              });
            }}
            onDelete={(id) => {
              startTransition(async () => {
                refreshAfter(await deletePlanItemAction(id));
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
            pending={pending}
            onName={setIncomeName}
            onAmount={setIncomeAmount}
            onExtra={setIncomeDate}
            onSubmit={() => {
              startTransition(async () => {
                const result = await createPlanIncomeAction({
                  name: incomeName,
                  amount: incomeAmount,
                  date: incomeDate,
                });
                if (!refreshAfter(result)) return;
                setIncomeName("");
                setIncomeAmount("");
              });
            }}
          />
        </PlanCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Fasta utgifter"
          hint="Samma dag varje månad"
          totalLabel="Summa"
          totalMinor={projection.fixedMinor}
          currency={currency}
        >
          <PlanRows
            items={projection.fixedItems}
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            editExtra={editDay}
            editExtraType="day"
            pending={pending}
            subtitle={(item) =>
              item.nextDueAt
                ? `Varje månad · ${labelDayOfMonthSv(dayOfMonthFromIso(item.nextDueAt))}`
                : "Varje månad"
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDay}
            onStartEdit={startEditExpense}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              startTransition(async () => {
                const day = Number(editDay);
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  dayOfMonth: Number.isFinite(day) ? day : 1,
                  monthKey,
                });
                if (refreshAfter(result)) setEditingId(null);
              });
            }}
            onDelete={(id) => {
              startTransition(async () => {
                refreshAfter(await deletePlanItemAction(id));
              });
            }}
          />

          <InlineAdd
            name={expenseName}
            amount={expenseAmount}
            extra={expenseDay}
            extraType="day"
            extraLabel="Dag"
            namePlaceholder="t.ex. Hyra, El, Netflix"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till fast utgift"
            pending={pending}
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onExtra={setExpenseDay}
            onSubmit={() => {
              startTransition(async () => {
                const day = Number(expenseDay);
                const result = await createPlanItemAction({
                  name: expenseName,
                  kind: "mandatory",
                  amount: expenseAmount,
                  dayOfMonth: Number.isFinite(day) ? day : 1,
                  monthKey,
                });
                if (!refreshAfter(result)) return;
                setExpenseName("");
                setExpenseAmount("");
              });
            }}
          />
        </PlanCard>

        <PlanCard
          title="Extra utgifter"
          hint="Engång med datum · bara den månaden"
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
            pending={pending}
            subtitle={(item) =>
              `Engång · ${labelIncomeDateSv(item.nextDueAt, timeZone)}`
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditExtra}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              startTransition(async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  date: editDate || undefined,
                });
                if (refreshAfter(result)) setEditingId(null);
              });
            }}
            onDelete={(id) => {
              startTransition(async () => {
                refreshAfter(await deletePlanItemAction(id));
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
            pending={pending}
            onName={setExtraName}
            onAmount={setExtraAmount}
            onExtra={setExtraDate}
            onSubmit={() => {
              startTransition(async () => {
                const result = await createPlanExtraAction({
                  name: extraName,
                  amount: extraAmount,
                  date: extraDate,
                });
                if (!refreshAfter(result)) return;
                setExtraName("");
                setExtraAmount("");
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
  hint: string;
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
          <p className="mt-0.5 text-sm text-[var(--numa-muted)]">{hint}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            {totalLabel}
          </p>
          <p className="money mt-0.5 text-base font-semibold">
            {formatMoney(money(totalMinor, currency))}
          </p>
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
  pending,
  subtitle,
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
  pending: boolean;
  subtitle: (item: PlanItem) => string;
  onEditName: (v: string) => void;
  onEditAmount: (v: string) => void;
  onEditExtra: (v: string) => void;
  onStartEdit: (item: PlanItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-[var(--numa-muted)]">Inget här ännu.</p>
    );
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
                <input
                  type="date"
                  value={editExtra}
                  onChange={(e) => onEditExtra(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm"
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
                disabled={pending}
                className="min-h-10 flex-1 rounded-xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-45"
                onClick={() => onSaveEdit(item.id)}
              >
                Spara
              </button>
              <button
                type="button"
                className="min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)]"
                onClick={onCancelEdit}
              >
                Avbryt
              </button>
            </div>
          </li>
        ) : (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-[var(--numa-faint)]">
                {subtitle(item)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="money text-sm font-semibold">
                {formatMoney(money(item.amountMinor, item.currency || currency))}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-[var(--numa-accent)]"
                disabled={pending}
                onClick={() => onStartEdit(item)}
              >
                Redigera
              </button>
              <button
                type="button"
                className="text-xs text-[var(--numa-muted)]"
                disabled={pending}
                onClick={() => onDelete(item.id)}
                aria-label={`Ta bort ${item.name}`}
              >
                ×
              </button>
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
  pending,
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
  pending: boolean;
  onName: (v: string) => void;
  onAmount: (v: string) => void;
  onExtra: (v: string) => void;
  onSubmit: () => void;
}) {
  const disabled =
    pending || !name.trim() || !amount.trim() || !String(extra).trim();
  return (
    <div className="mt-auto space-y-2 border-t border-[var(--numa-border)] pt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_6.5rem]">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={namePlaceholder}
          className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={amountPlaceholder}
          className="money min-h-11 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
        {extraType === "date" ? (
          <input
            type="date"
            value={extra}
            onChange={(e) => onExtra(e.target.value)}
            aria-label={extraLabel}
            className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
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
            className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          />
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        className="min-h-11 w-full rounded-xl bg-[var(--numa-accent-soft)] text-sm font-semibold text-[var(--numa-accent-ink)] transition hover:bg-[var(--numa-accent)] hover:text-white disabled:opacity-45"
        onClick={onSubmit}
      >
        {pending ? "Sparar…" : submitLabel}
      </button>
    </div>
  );
}

