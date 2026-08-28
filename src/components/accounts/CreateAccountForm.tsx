"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAccountAction } from "@/features/finance/actions";
import { CURRENCIES, type CurrencyCode } from "@/domain/money";

export function CreateAccountForm({
  primaryCurrency,
}: {
  primaryCurrency: CurrencyCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [useOnIdag, setUseOnIdag] = useState(false);
  const [form, setForm] = useState({
    name: "",
    institution: "",
    accountType: "checking" as
      | "checking"
      | "savings"
      | "cash"
      | "credit"
      | "investment"
      | "other",
    currency: primaryCurrency,
    maskedIdentifier: "",
    openingBalance: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAccountAction({
        ...form,
        makeDefault: useOnIdag,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(useOnIdag ? "/idag" : "/konton");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="numa-panel-strong space-y-4 p-5">
      <Field
        label="Namn (t.ex. Bangkok Bank eller Kontanter)"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Var pengarna finns"
        value={form.institution}
        onChange={(v) => setForm((f) => ({ ...f, institution: v }))}
      />
      <Field
        label="Kort etikett (valfritt)"
        value={form.maskedIdentifier}
        onChange={(v) => setForm((f) => ({ ...f, maskedIdentifier: v }))}
        placeholder="t.ex. 6591"
      />

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Valuta
        </span>
        <select
          value={form.currency}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              currency: e.target.value as CurrencyCode,
            }))
          }
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)]"
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code === "THB"
                ? "THB — baht"
                : code === "SEK"
                  ? "SEK — kronor"
                  : "EUR — euro (bunq/Revolut)"}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
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
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)]"
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

      <label className="numa-press flex min-h-11 items-start gap-3 rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 py-3 transition hover:border-[var(--numa-border-strong)]">
        <input
          type="checkbox"
          checked={useOnIdag}
          onChange={(e) => setUseOnIdag(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--numa-accent)]"
        />
        <span className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Använd på Hem (gör detta till ditt primära saldo)
        </span>
      </label>

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
        disabled={pending || !form.name.trim() || !form.openingBalance.trim()}
        className="numa-btn numa-btn-accent numa-cta-glow min-h-14 w-full text-[15px]"
      >
        {pending ? "Sparar…" : "Spara saldo och fortsätt"}
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
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
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
