"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "@/features/finance/actions";

const CATEGORIES = [
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

export function ManualExpenseForm({
  accountId,
  onSuccess,
}: {
  accountId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Mat");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const description = name.trim() || category;
    startTransition(async () => {
      const result = await createExpenseAction({
        accountId,
        amount,
        category,
        description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setName("");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Vad var det?
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="t.ex. Lunch, Grab"
          className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-sm text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Hur mycket?
        </span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="money min-h-14 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-3xl font-semibold text-[var(--numa-ink)] outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
          aria-label="Belopp"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`min-h-10 rounded-xl px-3 text-sm transition ${
              category === c
                ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                : "text-[var(--numa-muted)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !amount.trim()}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white transition enabled:active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? "Sparar…" : "Spara utgift"}
      </button>
    </form>
  );
}
