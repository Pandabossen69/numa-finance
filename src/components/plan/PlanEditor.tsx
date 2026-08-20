"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  addMonthsKey,
  dayOfMonthFromIso,
  extraSaldoHintSv,
  labelDayOfMonthSv,
  labelMonthNameSv,
  monthKeyFromDate,
  cumulativePlanSavingsMinor,
  monthLivingSaldoMinor,
  projectExtraSaldo,
  projectLivingBudget,
  projectPayCycle,
  projectPlanForMonth,
  yearFromMonthKey,
  visibleMonthKeysForYear,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { SV } from "@/features/copy/labels-sv";
import {
  createPlanExtraAction,
  createPlanIncomeAction,
  createPlanItemAction,
  deletePlanItemAction,
  setMonthSavingsAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

const EMPTY_MONTH_SPEND: Record<string, number> = {};

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
  bankBalanceMinor = null,
  cycleSpendingMinor = 0,
  todaySpendingMinor = 0,
  spendingByMonthKey = EMPTY_MONTH_SPEND,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
  bankBalanceMinor?: number | null;
  cycleSpendingMinor?: number;
  todaySpendingMinor?: number;
  spendingByMonthKey?: Record<string, number>;
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

  const projection = useMemo(
    () => projectPlanForMonth(items, monthKey, timeZone),
    [items, monthKey, timeZone],
  );

  const extra = useMemo(
    () =>
      projectExtraSaldo({
        planItems: items,
        spendingByMonthKey,
        monthKey,
        currentMonthKey,
        timeZone,
      }),
    [items, spendingByMonthKey, monthKey, currentMonthKey, timeZone],
  );
  const extraHint = extraSaldoHintSv(extra, currentMonthKey);
  const livingSaldoMinor = monthLivingSaldoMinor(extra);
  const savingsTotalMinor = useMemo(
    () => cumulativePlanSavingsMinor(items, monthKey, timeZone),
    [items, monthKey, timeZone],
  );
  const monthName = labelMonthNameSv(monthKey);
  const nextMonthName = labelMonthNameSv(addMonthsKey(monthKey, 1));
  const saldoOk = livingSaldoMinor >= 0;

  const cycle = useMemo(
    () => projectPayCycle(items, new Date(), timeZone),
    [items, timeZone],
  );

  const living = useMemo(
    () =>
      projectLivingBudget({
        cycle,
        now: new Date(),
        timeZone,
        bankBalanceMinor,
        cycleSpendingMinor,
        todaySpendingMinor,
      }),
    [cycle, timeZone, bankBalanceMinor, cycleSpendingMinor, todaySpendingMinor],
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
          ) : null}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1">
          {monthKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectMonth(key)}
              className={`numa-press min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold capitalize ${
                monthKey === key
                  ? "bg-[var(--numa-ink)] text-white shadow-[0_6px_16px_rgba(7,21,17,0.18)]"
                  : key === currentMonthKey
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)] ring-1 ring-[var(--numa-accent)]/35"
                    : "bg-white text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-accent-ink)]"
              }`}
            >
              {labelMonthNameSv(key)}
            </button>
          ))}
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-2">
          <section
            className="numa-panel-strong flex h-full min-w-0 flex-col gap-3 p-5 pl-6"
            aria-labelledby="plan-saldo-heading"
          >
            <p id="plan-saldo-heading" className="numa-section-title">
              {SV.saldo} · {monthName}
            </p>
            <div
              className={
                saldoOk
                  ? "text-[var(--numa-positive)]"
                  : "text-[var(--numa-danger)]"
              }
            >
              <MoneyDisplay
                amountMinor={livingSaldoMinor}
                currency={currency}
                size="lg"
                compact
                align="start"
              />
            </div>
            <p className="text-sm leading-snug text-[var(--numa-muted)]">
              {saldoOk ? SV.saldoLevaFor : SV.minusMotPlanen}
            </p>

            {extra.carriedInMinor > 0 && extra.monthResultMinor >= 0 ? (
              <BucketLine
                label="I månaden"
                amountMinor={extra.monthResultMinor}
                currency={currency}
              />
            ) : null}
            {extra.extraSaldoMinor > 0 ? (
              <BucketLine
                label={SV.extraSaldo}
                amountMinor={extra.extraSaldoMinor}
                currency={currency}
                tint="accent"
              />
            ) : extra.drawnMinor > 0 ? (
              <p className="text-sm text-[var(--numa-danger)]">{extraHint}</p>
            ) : null}
            {monthKey <= currentMonthKey && extra.spentMinor > 0 ? (
              <BucketLine
                label={SV.spenderatIManaden}
                amountMinor={extra.spentMinor}
                currency={currency}
              />
            ) : null}
            {monthKey === currentMonthKey && extra.monthResultMinor > 0 ? (
              <p className="text-sm text-[var(--numa-muted)]">
                Följer med till {nextMonthName}
              </p>
            ) : extra.extraSaldoMinor > 0 && extraHint ? (
              <p className="text-sm text-[var(--numa-muted)]">{extraHint}</p>
            ) : null}
            {cycle.startAt &&
            monthKey === (cycle.fundingMonthKey ?? currentMonthKey) &&
            living.mode !== "bridge" ? (
              <p className="text-sm text-[var(--numa-muted)]">
                <MoneyDisplay
                  amountMinor={living.dayBudgetMinor}
                  currency={currency}
                  size="sm"
                  compact
                  align="start"
                />{" "}
                / dag
              </p>
            ) : null}
          </section>

          <section
            className="numa-panel-park flex h-full min-w-0 flex-col gap-3 p-5 pl-6"
            aria-labelledby="plan-sparande-heading"
          >
            <p id="plan-sparande-heading" className="numa-section-title">
              {SV.sparande} · {monthName}
            </p>
            <div className="text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={savingsTotalMinor}
                currency={currency}
                size="lg"
                compact
                align="start"
              />
            </div>
            <p className="text-sm leading-snug text-[var(--numa-muted)]">
              {savingsTotalMinor <= 0
                ? "Inget avsatt än"
                : projection.savingsMinor <= 0
                  ? "Sparat i tidigare månader"
                  : savingsTotalMinor === projection.savingsMinor
                    ? `Avsatt i ${monthName}`
                    : "Sparat hittills"}
            </p>
            {savingsTotalMinor > 0 &&
            projection.savingsMinor > 0 &&
            savingsTotalMinor !== projection.savingsMinor ? (
              <BucketLine
                label={`I ${monthName}`}
                amountMinor={projection.savingsMinor}
                currency={currency}
              />
            ) : null}

            <div className="mt-auto space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
                Avsätt i {monthName}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={savingsAmount}
                  onChange={(e) => setSavingsAmount(e.target.value)}
                  placeholder="0"
                  aria-label={`Sparande i ${monthName}`}
                  className="money min-h-11 w-full min-w-0 max-w-[9rem] rounded-xl border border-[var(--numa-border)] bg-white px-3 text-base font-semibold outline-none focus:border-[var(--numa-accent)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      refreshAfter(
                        await setMonthSavingsAction({
                          monthKey,
                          amount:
                            savingsAmount.trim() === "" ? "0" : savingsAmount,
                        }),
                      );
                    })();
                  }}
                  className="numa-btn numa-btn-primary min-h-11 px-4"
                >
                  Avsätt
                </button>
                {projection.savingsMinor > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const result = await setMonthSavingsAction({
                          monthKey,
                          amount: "0",
                        });
                        if (refreshAfter(result)) setSavingsAmount("");
                      })();
                    }}
                    className="numa-press text-sm font-semibold text-[var(--numa-muted)]"
                  >
                    Nollställ
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>

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
            emptyHint="Lägg till lön eller CSN med datum."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditIncome}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              void (async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  date: editDate || undefined,
                });
                if (refreshAfter(result)) setEditingId(null);
              })();
            }}
            onDelete={(id) => {
              void (async () => {
                refreshAfter(await deletePlanItemAction(id));
              })();
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
            onName={setIncomeName}
            onAmount={setIncomeAmount}
            onExtra={setIncomeDate}
            onSubmit={() => {
              void (async () => {
                const result = await createPlanIncomeAction({
                  name: incomeName,
                  amount: incomeAmount,
                  date: incomeDate,
                });
                if (!refreshAfter(result)) return;
                setIncomeName("");
                setIncomeAmount("");
              })();
            }}
          />
        </PlanCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Fasta utgifter"
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
            emptyHint="Hyra, el, Netflix…"
            subtitle={(item) =>
              item.nextDueAt
                ? `den ${labelDayOfMonthSv(dayOfMonthFromIso(item.nextDueAt))}`
                : "Varje månad"
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDay}
            onStartEdit={startEditExpense}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              void (async () => {
                const day = Number(editDay);
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  dayOfMonth: Number.isFinite(day) ? day : 1,
                  monthKey,
                });
                if (refreshAfter(result)) setEditingId(null);
              })();
            }}
            onDelete={(id) => {
              void (async () => {
                refreshAfter(await deletePlanItemAction(id));
              })();
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
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onExtra={setExpenseDay}
            onSubmit={() => {
              void (async () => {
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
              })();
            }}
          />
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
            emptyHint="Engångskostnader med datum."
            subtitle={(item) => labelIncomeDateSv(item.nextDueAt, timeZone)}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onEditExtra={setEditDate}
            onStartEdit={startEditExtra}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              void (async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
                  date: editDate || undefined,
                });
                if (refreshAfter(result)) setEditingId(null);
              })();
            }}
            onDelete={(id) => {
              void (async () => {
                refreshAfter(await deletePlanItemAction(id));
              })();
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
            onName={setExtraName}
            onAmount={setExtraAmount}
            onExtra={setExtraDate}
            onSubmit={() => {
              void (async () => {
                const result = await createPlanExtraAction({
                  name: extraName,
                  amount: extraAmount,
                  date: extraDate,
                });
                if (!refreshAfter(result)) return;
                setExtraName("");
                setExtraAmount("");
              })();
            }}
          />
        </PlanCard>
      </div>
    </div>
  );
}

function BucketLine({
  label,
  amountMinor,
  currency,
  tint = "ink",
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  tint?: "ink" | "accent";
}) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[var(--numa-muted)]">{label}</span>
      <span
        className={
          tint === "accent"
            ? "text-[var(--numa-accent-ink)]"
            : "text-[var(--numa-ink)]"
        }
      >
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="sm"
          compact
          align="end"
        />
      </span>
    </p>
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
  emptyHint?: string;
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
      <p className="py-4 text-sm text-[var(--numa-muted)]">{emptyHint}</p>
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
                className="numa-btn numa-btn-accent min-h-10 flex-1"
                onClick={() => onSaveEdit(item.id)}
              >
                Spara
              </button>
              <button
                type="button"
                className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)]"
                onClick={onCancelEdit}
              >
                Avbryt
              </button>
            </div>
          </li>
        ) : (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-[var(--numa-faint)]">
                {subtitle(item)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 text-[var(--numa-ink)]">
                <MoneyDisplay
                  amountMinor={item.amountMinor}
                  currency={(item.currency || currency) as CurrencyCode}
                  size="sm"
                  compact
                  align="end"
                />
              </span>
              <button
                type="button"
                className="numa-press inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--numa-accent)]"
                onClick={() => onStartEdit(item)}
              >
                Redigera
              </button>
              <button
                type="button"
                className="numa-press inline-flex min-h-11 min-w-11 items-center justify-center text-lg text-[var(--numa-muted)]"
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
  onName: (v: string) => void;
  onAmount: (v: string) => void;
  onExtra: (v: string) => void;
  onSubmit: () => void;
}) {
  const disabled = !name.trim() || !amount.trim() || !String(extra).trim();
  return (
    <div className="mt-auto space-y-2 border-t border-[var(--numa-border)] pt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_6.5rem]">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={namePlaceholder}
          className="min-h-11 rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-base outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder={amountPlaceholder}
          className="money min-h-11 rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)]/80 px-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
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
        className="numa-btn numa-btn-soft w-full"
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}

