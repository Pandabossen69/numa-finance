"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTransactionAction,
  voidTransactionAction,
} from "@/features/finance/actions";
import { formatMoney, moneyFromUnknown, type CurrencyCode } from "@/domain/money";

const EXPENSE_CATEGORIES = [
  "Mat",
  "Café",
  "Transport",
  "Boende",
  "Räkning",
  "Hälsa",
  "Shopping",
  "Nöje",
  "Övrigt",
] as const;

export type EditableTx = {
  id: string;
  description: string;
  category: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  direction: "debit" | "credit";
  transactionType: string;
  source: string;
  canEdit: boolean;
};

export function TransactionRow({ tx }: { tx: EditableTx }) {
  const [open, setOpen] = useState(false);
  const sign = tx.direction === "debit" ? "−" : "+";

  return (
    <li className="border-b border-[var(--numa-border)] py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--numa-ink)]">
            {tx.description}
          </p>
          <p className="mt-1 text-xs text-[var(--numa-faint)]">
            {labelType(tx.transactionType)}
            {tx.category ? ` · ${tx.category}` : ""}
            <span className="text-[var(--numa-accent)]"> · Ändra</span>
          </p>
        </div>
        <span
          className={`money shrink-0 font-semibold ${
            tx.direction === "credit"
              ? "text-[var(--numa-positive)]"
              : "text-[var(--numa-ink)]"
          }`}
        >
          {sign}
          {formatMoney(moneyFromUnknown(tx.amountMinor, tx.currency))}
        </span>
      </button>

      {open ? (
        <div className="mt-3 rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-3 py-3">
          <TransactionEditor tx={tx} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </li>
  );
}

function TransactionEditor({
  tx,
  onDone,
}: {
  tx: EditableTx;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(tx.description);
  const [amount, setAmount] = useState(
    (Math.abs(tx.amountMinor) / 100).toString().replace(".", ","),
  );
  const [category, setCategory] = useState(tx.category ?? "Övrigt");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editable =
    tx.canEdit &&
    tx.transactionType !== "transfer" &&
    tx.transactionType !== "cash_withdrawal";

  return (
    <div className="space-y-3">
      {editable ? (
        <>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--numa-faint)]">
              Namn
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-sm text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[var(--numa-faint)]">
              Belopp
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="money min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-lg font-semibold text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
            />
          </label>
          {tx.transactionType === "expense" ? (
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`min-h-9 rounded-lg px-2.5 text-xs ${
                    category === c
                      ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                      : "text-[var(--numa-muted)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            disabled={pending || !name.trim() || !amount.trim()}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await updateTransactionAction({
                  id: tx.id,
                  description: name,
                  category:
                    tx.transactionType === "expense" ? category : tx.category,
                  amount,
                });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onDone();
                router.refresh();
              });
            }}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--numa-accent)] text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Sparar…" : "Spara ändringar"}
          </button>
        </>
      ) : (
        <p className="text-sm text-[var(--numa-muted)]">
          Den här typen tas bort och läggs till på nytt om du vill ändra
          beloppet.
        </p>
      )}

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Ta bort den här rörelsen från historiken?")) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await voidTransactionAction(tx.id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            onDone();
            router.refresh();
          });
        }}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--numa-danger)]/40 text-sm font-medium text-[var(--numa-danger)]"
      >
        Ta bort
      </button>
    </div>
  );
}

function labelType(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Flytt";
    case "cash_withdrawal":
      return "Kontant";
    case "refund":
      return "Återbetalning";
    default:
      return "Rörelse";
  }
}
