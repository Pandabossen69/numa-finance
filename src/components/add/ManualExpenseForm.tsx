"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "@/features/finance/actions";

const CATEGORIES = ["Mat", "Transport", "Shopping", "Boende", "Övrigt"] as const;

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
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createExpenseAction({
        accountId,
        amount,
        category,
        description: description || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAmount("");
      setDescription("");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Skriv belopp
        </span>
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="money w-full rounded-2xl border border-[var(--numa-border)] bg-white/70 px-4 py-4 text-3xl font-semibold outline-none ring-[var(--numa-accent)] focus:ring-2 dark:bg-black/20"
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
                : "bg-transparent text-[var(--numa-muted)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Beskrivning</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Valfri beskrivning"
          className="w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>

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
        {pending ? "Sparar…" : "Spara"}
      </button>
    </form>
  );
}
