"use client";

import { useMemo, useState, useTransition } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import { useRouter } from "next/navigation";
import { createAccountAction } from "@/features/finance/actions";
import {
  ACCOUNT_KIND_LABEL_SV,
  ACCOUNT_KINDS,
  currenciesForAccountKind,
  defaultCurrencyForKind,
  defaultNameForKind,
  type AccountKind,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export function CreateAccountForm({
  primaryCurrency,
}: {
  primaryCurrency: CurrencyCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);
  const [error, setError] = useState<string | null>(null);
  const [useOnIdag, setUseOnIdag] = useState(false);
  const initialKind: AccountKind =
    primaryCurrency === "THB" ? "thai_bank" : "other";
  const [form, setForm] = useState<{
    name: string;
    institution: string;
    kind: AccountKind;
    accountType:
      | "checking"
      | "savings"
      | "cash"
      | "credit"
      | "investment"
      | "other";
    currency: CurrencyCode;
    maskedIdentifier: string;
    openingBalance: string;
    fxRate: string;
  }>({
    name: defaultNameForKind(initialKind),
    institution: "",
    kind: initialKind,
    accountType: "checking",
    currency: defaultCurrencyForKind(initialKind),
    maskedIdentifier: "",
    openingBalance: "",
    fxRate: "",
  });

  const allowedCurrencies = useMemo(
    () => currenciesForAccountKind(form.kind),
    [form.kind],
  );
  const needsFx = form.currency !== "THB";

  function onKindChange(kind: AccountKind) {
    const currency = defaultCurrencyForKind(kind);
    setForm((f) => ({
      ...f,
      kind,
      currency,
      accountType: kind === "cash" ? "cash" : f.accountType === "cash" ? "checking" : f.accountType,
      name:
        !f.name.trim() ||
        ACCOUNT_KINDS.some((k) => defaultNameForKind(k) === f.name)
          ? defaultNameForKind(kind)
          : f.name,
      fxRate: currency === "THB" ? "" : f.fxRate,
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      const result = await createAccountAction({
        name: form.name,
        institution: form.institution || null,
        accountType: form.accountType,
        kind: form.kind,
        currency: form.currency,
        maskedIdentifier: form.maskedIdentifier || null,
        openingBalance: form.openingBalance,
        fxRate: needsFx ? form.fxRate || null : null,
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
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Var pengarna finns
        </span>
        <select
          value={form.kind}
          onChange={(e) => onKindChange(e.target.value as AccountKind)}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)]"
        >
          {ACCOUNT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ACCOUNT_KIND_LABEL_SV[kind]}
            </option>
          ))}
        </select>
      </label>

      <Field
        label="Namn"
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label="Bank / etikett (valfritt)"
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
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Valuta
        </span>
        <select
          value={form.currency}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              currency: e.target.value as CurrencyCode,
              fxRate: e.target.value === "THB" ? "" : f.fxRate,
            }))
          }
          disabled={allowedCurrencies.length === 1}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] disabled:opacity-70"
        >
          {allowedCurrencies.map((code) => (
            <option key={code} value={code}>
              {code === "THB"
                ? "THB — baht"
                : code === "SEK"
                  ? "SEK — kronor"
                  : code === "EUR"
                    ? "EUR — euro"
                    : "USD — dollar"}
            </option>
          ))}
        </select>
        {allowedCurrencies.length === 1 ? (
          <p className="mt-1.5 text-xs text-[var(--numa-faint)]">
            {ACCOUNT_KIND_LABEL_SV[form.kind]} är alltid {form.currency}.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[var(--numa-faint)]">
            Ett konto = en valuta. Revolut EUR och SEK = två konton.
          </p>
        )}
      </label>

      <Field
        label="Hur mycket har du just nu?"
        value={form.openingBalance}
        onChange={(v) => setForm((f) => ({ ...f, openingBalance: v }))}
        placeholder="t.ex. 10058,04"
        inputMode="decimal"
      />

      {needsFx ? (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
            Växelkurs (THB per 1 {form.currency})
          </span>
          <input
            value={form.fxRate}
            onChange={(e) => setForm((f) => ({ ...f, fxRate: e.target.value }))}
            placeholder="Lämna tomt för marknadspris"
            inputMode="decimal"
            className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
          />
          <p className="mt-1.5 text-xs text-[var(--numa-faint)]">
            Kursen låses när du sparar — saldot räknas om till THB en gång.
          </p>
        </label>
      ) : null}

      <label className="numa-press flex min-h-11 items-start gap-3 rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 py-3 transition hover:border-[var(--numa-border-strong)]">
        <input
          type="checkbox"
          checked={useOnIdag}
          onChange={(e) => setUseOnIdag(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--numa-accent)]"
        />
        <span className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Använd på Hem (gör detta till ditt primära konto för utgifter)
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
        Totalsumman på Hem är alltid i THB — alla konton räknas ihop.
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
