"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlanCategoryKind, PlanItem } from "@/domain/finance";
import { NEXT_INCOME_NAME } from "@/domain/finance";
import { formatMoney, money, type CurrencyCode } from "@/domain/money";
import {
  createPlanItemAction,
  deletePlanItemAction,
  setNextIncomeDateAction,
} from "@/features/plan/actions";

const KIND_OPTIONS: Array<{ id: PlanCategoryKind; label: string; hint: string }> =
  [
    { id: "mandatory", label: "Måste", hint: "Hyra, räkningar" },
    { id: "expected", label: "Vardag", hint: "Mat, transport" },
    { id: "flexible", label: "Flex", hint: "Shopping som kan vänta" },
    { id: "goal", label: "Mål", hint: "Sparande / planerat köp" },
    { id: "buffer", label: "Buffert", hint: "Säkerhetsmarginal" },
  ];

function kindLabel(kind: PlanCategoryKind): string {
  return KIND_OPTIONS.find((k) => k.id === kind)?.label ?? kind;
}

export function PlanEditor({
  items,
  currency,
  daysUntilIncome,
}: {
  items: PlanItem[];
  currency: CurrencyCode;
  daysUntilIncome: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<PlanCategoryKind>("mandatory");
  const [incomeDate, setIncomeDate] = useState(() => {
    const existing = items.find((i) => i.name === NEXT_INCOME_NAME)?.nextDueAt;
    return existing ? existing.slice(0, 10) : "";
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => items.filter((i) => i.name !== NEXT_INCOME_NAME),
    [items],
  );

  return (
    <div className="space-y-8">
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
        <h2 className="font-medium">Dina hinkar</h2>
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Inga hinkar ännu. Lägg till det som redan är planerat — då krymper
            “tryggt idag” till det som faktiskt är ledigt.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
            {visible.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--numa-faint)]">
                    {kindLabel(item.kind)} · månadsvis
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="money text-sm font-semibold">
                    {formatMoney(money(item.amountMinor, item.currency))}
                  </span>
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">Lägg till hink</h2>
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
    </div>
  );
}
