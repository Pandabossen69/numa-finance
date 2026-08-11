"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  NEXT_INCOME_NAME,
  isRecurringMonthly,
  labelMonthSv,
  projectPlanForMonth,
  upcomingMonthKeys,
} from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import {
  createPlanIncomeAction,
  createPlanItemAction,
  deletePlanItemAction,
  setNextIncomeDateAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

function minorToUi(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
}

export function PlanEditor({
  items,
  currency,
  daysUntilIncome,
  timeZone,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  daysUntilIncome: number;
  timeZone: string;
}) {
  const router = useRouter();
  const monthKeys = useMemo(
    () => upcomingMonthKeys(new Date(), timeZone, 4),
    [timeZone],
  );
  const [monthKey, setMonthKey] = useState(monthKeys[0]!);

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const [incomeDate, setIncomeDate] = useState(() => {
    const existing = items.find((i) => i.name === NEXT_INCOME_NAME)?.nextDueAt;
    return existing ? existing.slice(0, 10) : "";
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const projection = useMemo(
    () => projectPlanForMonth(items, monthKey, timeZone),
    [items, monthKey, timeZone],
  );

  const balanceMinor = projection.incomeMinor - projection.totalPlannedMinor;

  function refreshAfter(result: { ok: true } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  }

  function startEdit(item: PlanItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAmount(minorToUi(item.amountMinor));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {monthKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMonthKey(key);
                setEditingId(null);
              }}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold capitalize transition ${
                monthKey === key
                  ? "bg-[var(--numa-ink)] text-white shadow-sm"
                  : "bg-white/70 text-[var(--numa-muted)] hover:bg-white"
              }`}
            >
              {labelMonthSv(key)}
            </button>
          ))}
        </div>

        <div className="numa-panel grid gap-4 p-4 sm:grid-cols-4">
          <MonthStat
            label="Intäkter"
            amountMinor={projection.incomeMinor}
            currency={currency}
            tone="positive"
          />
          <MonthStat
            label="Utgifter"
            amountMinor={projection.totalPlannedMinor}
            currency={currency}
          />
          <MonthStat
            label="Buffert"
            amountMinor={projection.bufferMinor}
            currency={currency}
          />
          <MonthStat
            label="Kvar"
            amountMinor={balanceMinor}
            currency={currency}
            tone={balanceMinor >= 0 ? "positive" : "danger"}
          />
        </div>

        <p className="text-sm text-[var(--numa-muted)]">
          Fasta utgifter följer med till nästa månad. Intäkter fyller du i
          manuellt för varje månad.
        </p>
      </section>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Intäkter"
          hint={`Fyll i för ${projection.labelSv} — följer inte med automatiskt`}
          totalLabel="Summa"
          totalMinor={projection.incomeMinor}
          currency={currency}
          empty="Inga intäkter den här månaden ännu."
        >
          <PlanRows
            items={projection.incomes}
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            pending={pending}
            subtitle={() => "Denna månad"}
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              startTransition(async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
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
            namePlaceholder="t.ex. Lön, Trukks, CSN"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till intäkt"
            pending={pending}
            onName={setIncomeName}
            onAmount={setIncomeAmount}
            onSubmit={() => {
              startTransition(async () => {
                const result = await createPlanIncomeAction({
                  name: incomeName,
                  amount: incomeAmount,
                  monthKey,
                });
                if (!refreshAfter(result)) return;
                setIncomeName("");
                setIncomeAmount("");
              });
            }}
          />
        </PlanCard>

        <PlanCard
          title="Fasta utgifter"
          hint="Hyra, abonnemang, räkningar — syns i kommande månader"
          totalLabel="Summa"
          totalMinor={projection.totalPlannedMinor}
          currency={currency}
          empty="Inga fasta utgifter ännu. Lägg till så följer de med."
        >
          <PlanRows
            items={projection.items}
            currency={currency}
            editingId={editingId}
            editName={editName}
            editAmount={editAmount}
            pending={pending}
            subtitle={(item) =>
              isRecurringMonthly(item) ? "Varje månad" : "Denna period"
            }
            onEditName={setEditName}
            onEditAmount={setEditAmount}
            onStartEdit={startEdit}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(id) => {
              startTransition(async () => {
                const result = await updatePlanItemAction({
                  id,
                  name: editName,
                  amount: editAmount,
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
            namePlaceholder="t.ex. Hyra, El, Cursor"
            amountPlaceholder={`Belopp (${currency})`}
            submitLabel="Lägg till utgift"
            pending={pending}
            onName={setExpenseName}
            onAmount={setExpenseAmount}
            onSubmit={() => {
              startTransition(async () => {
                const result = await createPlanItemAction({
                  name: expenseName,
                  kind: "mandatory",
                  amount: expenseAmount,
                });
                if (!refreshAfter(result)) return;
                setExpenseName("");
                setExpenseAmount("");
              });
            }}
          />
        </PlanCard>
      </div>

      <section className="numa-panel space-y-3 p-4">
        <div>
          <h2 className="font-medium">Nästa inkomst (daglig spridning)</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            Används på Hem för att sprida det lediga beloppet. Nu:{" "}
            {daysUntilIncome} dagar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="date"
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            className="min-h-12 flex-1 rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm"
          />
          <button
            type="button"
            disabled={pending || !incomeDate}
            className="min-h-12 rounded-2xl bg-[var(--numa-ink)] px-5 text-sm font-medium text-white disabled:opacity-45"
            onClick={() => {
              startTransition(async () => {
                refreshAfter(await setNextIncomeDateAction(incomeDate));
              });
            }}
          >
            Spara datum
          </button>
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  hint,
  totalLabel,
  totalMinor,
  currency,
  empty,
  children,
}: {
  title: string;
  hint: string;
  totalLabel: string;
  totalMinor: number;
  currency: CurrencyCode;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="numa-panel-strong flex flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">{hint}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            {totalLabel}
          </p>
          <p className="money mt-1 text-base font-semibold">
            {formatMoney(money(totalMinor, currency))}
          </p>
        </div>
      </header>
      <div className="flex min-h-[12rem] flex-1 flex-col gap-4">
        {children}
      </div>
      <span className="sr-only">{empty}</span>
    </section>
  );
}

function PlanRows({
  items,
  currency,
  editingId,
  editName,
  editAmount,
  pending,
  subtitle,
  onEditName,
  onEditAmount,
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
  pending: boolean;
  subtitle: (item: PlanItem) => string;
  onEditName: (v: string) => void;
  onEditAmount: (v: string) => void;
  onStartEdit: (item: PlanItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-[var(--numa-bg)]/70 px-4 py-6 text-sm text-[var(--numa-muted)]">
        Inget här ännu.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--numa-border)] overflow-hidden rounded-2xl border border-[var(--numa-border)] bg-white/50">
      {items.map((item) =>
        editingId === item.id ? (
          <li key={item.id} className="space-y-3 bg-white p-3">
            <input
              value={editName}
              onChange={(e) => onEditName(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
            />
            <input
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => onEditAmount(e.target.value)}
              className="money min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-lg font-semibold"
            />
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
            className="flex items-center justify-between gap-3 px-3 py-3"
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
  namePlaceholder,
  amountPlaceholder,
  submitLabel,
  pending,
  onName,
  onAmount,
  onSubmit,
}: {
  name: string;
  amount: string;
  namePlaceholder: string;
  amountPlaceholder: string;
  submitLabel: string;
  pending: boolean;
  onName: (v: string) => void;
  onAmount: (v: string) => void;
  onSubmit: () => void;
}) {
  const disabled = pending || !name.trim() || !amount.trim();
  return (
    <div className="mt-auto space-y-2 border-t border-[var(--numa-border)] pt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
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

function MonthStat({
  label,
  amountMinor,
  currency,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  tone?: "positive" | "danger";
}) {
  const color =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "";
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <p className={`money mt-1 text-lg font-semibold ${color}`}>
        {formatMoney(money(amountMinor, currency))}
      </p>
    </div>
  );
}
