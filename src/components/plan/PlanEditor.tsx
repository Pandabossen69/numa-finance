"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanCategoryKind, PlanItem } from "@/domain/finance";
import {
  NEXT_INCOME_NAME,
  isRecurringMonthly,
  labelMonthSv,
  projectPlanForMonth,
  upcomingMonthKeys,
} from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import {
  createPlanItemAction,
  deletePlanItemAction,
  setNextIncomeDateAction,
  updatePlanItemAction,
} from "@/features/plan/actions";

const KIND_OPTIONS: Array<{ id: PlanCategoryKind; label: string; hint: string }> =
  [
    {
      id: "mandatory",
      label: "Fast",
      hint: "Hyra, räkningar — följer med till nästa månad",
    },
    { id: "expected", label: "Vardag", hint: "Mat, transport — månadsvis" },
    { id: "flexible", label: "Flex", hint: "Shopping som kan vänta" },
    { id: "goal", label: "Mål", hint: "Sparande / planerat köp" },
    { id: "buffer", label: "Buffert", hint: "Säkerhetsmarginal" },
  ];

function kindLabel(kind: PlanCategoryKind): string {
  return KIND_OPTIONS.find((k) => k.id === kind)?.label ?? kind;
}

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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<PlanCategoryKind>("mandatory");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editKind, setEditKind] = useState<PlanCategoryKind>("mandatory");
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

  const isCurrentMonth = monthKey === monthKeys[0];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">Kommande månader</h2>
        <p className="text-sm text-[var(--numa-muted)]">
          Fasta utgifter följer med automatiskt. Du kan alltid ändra eller ta
          bort dem.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {monthKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMonthKey(key)}
              className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-semibold capitalize transition ${
                monthKey === key
                  ? "bg-[var(--numa-ink)] text-white"
                  : "bg-white/60 text-[var(--numa-muted)]"
              }`}
            >
              {labelMonthSv(key)}
            </button>
          ))}
        </div>
        <div className="numa-panel grid gap-3 p-4 sm:grid-cols-3">
          <MonthStat
            label="Reserverat"
            amountMinor={projection.reservedMinor}
            currency={currency}
          />
          <MonthStat
            label="Buffert"
            amountMinor={projection.bufferMinor}
            currency={currency}
          />
          <MonthStat
            label="Totalt planerat"
            amountMinor={projection.totalPlannedMinor}
            currency={currency}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Nästa inkomst</h2>
        <p className="text-sm text-[var(--numa-muted)]">
          Används för att sprida det lediga beloppet över dagarna. Nu:{" "}
          {daysUntilIncome} dagar.
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={incomeDate}
            onChange={(e) => setIncomeDate(e.target.value)}
            className="min-h-12 flex-1 rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm"
          />
          <button
            type="button"
            disabled={pending || !incomeDate}
            className="min-h-12 rounded-2xl bg-[var(--numa-accent)] px-4 text-sm font-medium text-white disabled:opacity-45"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await setNextIncomeDateAction(incomeDate);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Spara
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">
          Plan · {projection.labelSv}
        </h2>
        {projection.items.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Inga poster den här månaden. Lägg till fasta utgifter — de syns i
            kommande månader också.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
            {projection.items.map((item) =>
              editingId === item.id ? (
                <li key={item.id} className="space-y-3 py-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    {KIND_OPTIONS.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setEditKind(k.id)}
                        className={`min-h-9 rounded-lg px-2.5 text-xs ${
                          editKind === k.id
                            ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                            : "text-[var(--numa-muted)]"
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <input
                    inputMode="decimal"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="money min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-white/70 px-3 text-lg font-semibold"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      className="min-h-10 flex-1 rounded-xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-45"
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const result = await updatePlanItemAction({
                            id: item.id,
                            name: editName,
                            kind: editKind,
                            amount: editAmount,
                          });
                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }
                          setEditingId(null);
                          router.refresh();
                        });
                      }}
                    >
                      Spara
                    </button>
                    <button
                      type="button"
                      className="min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)]"
                      onClick={() => setEditingId(null)}
                    >
                      Avbryt
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--numa-faint)]">
                      {kindLabel(item.kind)}
                      {isRecurringMonthly(item)
                        ? " · varje månad"
                        : " · denna period"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="money text-sm font-semibold">
                      {formatMoney(money(item.amountMinor, item.currency))}
                    </span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--numa-accent)]"
                        disabled={pending}
                        onClick={() => {
                          setEditingId(item.id);
                          setEditName(item.name);
                          setEditAmount(minorToUi(item.amountMinor));
                          setEditKind(item.kind);
                        }}
                      >
                        Redigera
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[var(--numa-muted)]"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await deletePlanItemAction(item.id);
                            router.refresh();
                          });
                        }}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {isCurrentMonth ? (
        <section className="space-y-4">
          <h2 className="font-medium">Lägg till i planen</h2>
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`min-h-10 rounded-xl px-3 text-sm ${
                  kind === k.id
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                    : "text-[var(--numa-muted)]"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--numa-faint)]">
            {KIND_OPTIONS.find((k) => k.id === kind)?.hint}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Namn, t.ex. Hyra"
            className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          />
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Belopp (${currency})`}
            className="money min-h-14 w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 text-2xl font-semibold outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          />
          {error ? (
            <p className="text-sm text-[var(--numa-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !name.trim() || !amount.trim()}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-45"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await createPlanItemAction({ name, kind, amount });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setName("");
                setAmount("");
                router.refresh();
              });
            }}
          >
            {pending ? "Sparar…" : "Lägg till i planen"}
          </button>
        </section>
      ) : (
        <p className="text-sm text-[var(--numa-muted)]">
          Nya poster läggs till i innevarande månad och syns i kommande månader
          om de är månadsvisa/fasta.
        </p>
      )}
    </div>
  );
}

function MonthStat({
  label,
  amountMinor,
  currency,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
}) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <p className="money mt-1 text-lg font-semibold">
        {formatMoney(money(amountMinor, currency))}
      </p>
    </div>
  );
}
