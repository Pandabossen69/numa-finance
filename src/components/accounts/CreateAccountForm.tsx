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
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[1.5rem] border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] p-4"
    >
      <Field
        label="Kontonamn"
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
        <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
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
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none"
        >
          <option value="THB">THB — baht</option>
          <option value="SEK">SEK — kronor</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
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
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none"
        >
          <option value="checking">Löpande konto</option>
          <option value="savings">Sparkonto</option>
          <option value="cash">Kontanter</option>
          <option value="other">Övrigt</option>
        </select>
      </label>

      <Field
        label="Verifierat saldo just nu"
        value={form.openingBalance}
        onChange={(v) => setForm((f) => ({ ...f, openingBalance: v }))}
        placeholder="t.ex. 10058,04"
        inputMode="decimal"
      />

      {error ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_14%,transparent)] px-3 py-2.5 text-sm text-[var(--numa-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !form.openingBalance.trim()}
        className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white disabled:opacity-45"
      >
        {pending ? "Sparar…" : "Spara och fortsätt"}
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
      <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
      />
    </label>
  );
}
