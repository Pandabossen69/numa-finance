"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAccountAction } from "@/features/finance/actions";

export function CreateAccountForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Bangkok Bank",
    institution: "Bangkok Bank",
    accountType: "checking" as
      | "checking"
      | "savings"
      | "cash"
      | "credit"
      | "investment"
      | "other",
    currency: "THB" as "THB" | "SEK",
    maskedIdentifier: "6591",
    openingBalance: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAccountAction({
        ...form,
        makeDefault: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/idag");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label="Namn"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Bank / institution"
        value={form.institution}
        onChange={(v) => setForm((f) => ({ ...f, institution: v }))}
      />
      <Field
        label="Kontosiffra (maskerad)"
        value={form.maskedIdentifier}
        onChange={(v) => setForm((f) => ({ ...f, maskedIdentifier: v }))}
        placeholder="t.ex. 6591"
      />

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Valuta
        </span>
        <select
          value={form.currency}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              currency: e.target.value as "THB" | "SEK",
            }))
          }
          className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none"
        >
          <option value="THB">THB — baht</option>
          <option value="SEK">SEK — kronor</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Typ
        </span>
        <select
          value={form.accountType}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              accountType: e.target.value as typeof form.accountType,
            }))
          }
          className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none"
        >
          <option value="checking">Löpande konto</option>
          <option value="savings">Sparkonto</option>
          <option value="cash">Kontanter</option>
          <option value="other">Övrigt</option>
        </select>
      </label>

      <Field
        label="Verifierat / ingående saldo"
        value={form.openingBalance}
        onChange={(v) => setForm((f) => ({ ...f, openingBalance: v }))}
        placeholder="t.ex. 10058,04"
        inputMode="decimal"
      />

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sparar…" : "Spara konto"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
      />
    </label>
  );
}
