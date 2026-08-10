"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAccountAction } from "@/features/finance/actions";

export function CreateAccountForm({
  onSuccess,
  hasExistingAccounts = false,
}: {
  onSuccess?: () => void;
  /** When true, new saldo does not steal Idag's primary unless user opts in. */
  hasExistingAccounts?: boolean;
} = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(!hasExistingAccounts);
  const [form, setForm] = useState({
    name: hasExistingAccounts ? "" : "Bangkok Bank",
    institution: hasExistingAccounts ? "" : "Bangkok Bank",
    accountType: "checking" as
      | "checking"
      | "savings"
      | "cash"
      | "credit"
      | "investment"
      | "other",
    currency: "THB" as "THB" | "SEK",
    maskedIdentifier: hasExistingAccounts ? "" : "",
    openingBalance: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Ge saldot ett namn, t.ex. Bangkok Bank eller Kontanter");
      return;
    }
    startTransition(async () => {
      const result = await createAccountAction({
        ...form,
        name: form.name.trim(),
        institution: form.institution.trim() || null,
        maskedIdentifier: form.maskedIdentifier.trim() || null,
        makeDefault: hasExistingAccounts ? makeDefault : true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (onSuccess) {
        onSuccess();
        router.refresh();
        return;
      }
      window.location.assign(
        makeDefault || !hasExistingAccounts ? "/idag" : "/konton",
      );
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[1.5rem] border border-[var(--numa-border)] bg-[var(--numa-surface-solid)] p-4"
    >
      <Field
        label="Namn"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        placeholder="t.ex. Bangkok Bank, Spar, Kontanter"
      />
      <Field
        label="Var pengarna finns (valfritt)"
        value={form.institution}
        onChange={(v) => setForm((f) => ({ ...f, institution: v }))}
        placeholder="t.ex. Bangkok Bank"
      />
      <Field
        label="Kort etikett (valfritt)"
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
        label="Hur mycket har du just nu?"
        value={form.openingBalance}
        onChange={(v) => setForm((f) => ({ ...f, openingBalance: v }))}
        placeholder="t.ex. 10058,04"
        inputMode="decimal"
      />

      {hasExistingAccounts ? (
        <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-[var(--numa-border)] px-3 py-3">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--numa-accent)]"
          />
          <span className="text-sm leading-relaxed text-[var(--numa-ink)]">
            Använd som standard på Idag
            <span className="mt-0.5 block text-xs text-[var(--numa-muted)]">
              Annars behåller du ditt nuvarande standardkonto. Du kan byta under
              Mina saldon.
            </span>
          </span>
        </label>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--numa-muted)]">
          Det här blir ditt standardkonto på Idag — det NUMA räknar tryggt
          spendera ifrån.
        </p>
      )}

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
        disabled={pending || !form.openingBalance.trim() || !form.name.trim()}
        className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white disabled:opacity-45"
      >
        {pending ? "Sparar…" : "Spara saldo"}
      </button>
      <p className="text-center text-xs leading-relaxed text-[var(--numa-faint)]">
        Tips: använd saldot du ser i bankappen eller senaste SMS just nu.
      </p>
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
