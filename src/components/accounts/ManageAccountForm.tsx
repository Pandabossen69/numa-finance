"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_KIND_LABEL_SV,
  ACCOUNT_KINDS,
  CHOOSE_OTHER_DEFAULT_SV,
  CURRENCY_LOCKED_SV,
  DEFAULT_ACCOUNT_BLOCK_SV,
  DEFAULT_ACCOUNT_COPY_SV,
  DEFAULT_ACCOUNT_HELP_SV,
  DELETE_REQUIRES_ZERO_SV,
  DELETE_UNKNOWN_SALDO_SV,
  currenciesForAccountKind,
  defaultCurrencyForKind,
  type AccountKind,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import {
  archiveAccountAction,
  deleteAccountAction,
  restoreAccountAction,
  updateAccountAction,
} from "@/features/finance/actions";
import type { AccountDetail } from "@/features/finance/load-account-detail";
import { useSubmitGuard } from "@/lib/forms/submit-guard";

function currencyLabel(code: CurrencyCode): string {
  if (code === "THB") return "THB — baht";
  if (code === "SEK") return "SEK — kronor";
  if (code === "EUR") return "EUR — euro";
  return "USD — dollar";
}

export function ManageAccountForm({ account }: { account: AccountDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "delete" | "archive">(null);
  const [form, setForm] = useState<{
    name: string;
    kind: AccountKind;
    currency: CurrencyCode;
    makeDefault: boolean;
  }>({
    name: account.name,
    kind: account.kind,
    currency: account.currency,
    makeDefault: account.isDefault,
  });

  const currencyLocked = account.hasLedgerHistory;
  const allowedCurrencies = useMemo(
    () => currenciesForAccountKind(form.kind),
    [form.kind],
  );

  function onKindChange(kind: AccountKind) {
    const allowed = currenciesForAccountKind(kind);
    setForm((current) => ({
      ...current,
      kind,
      currency:
        currencyLocked || allowed.includes(current.currency)
          ? current.currency
          : defaultCurrencyForKind(kind),
    }));
  }

  function finish(result: { ok: true } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      setConfirm(null);
      return;
    }
    router.push("/konton");
    router.refresh();
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      finish(
        await updateAccountAction({
          id: account.id,
          name: form.name,
          kind: form.kind,
          currency: form.currency,
          makeDefault: form.makeDefault,
        }),
      );
    });
  }

  function onDelete() {
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      finish(await deleteAccountAction(account.id));
    });
  }

  function onArchive() {
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      finish(await archiveAccountAction(account.id));
    });
  }

  function onRestore() {
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      finish(await restoreAccountAction(account.id));
    });
  }

  if (!account.isActive) {
    return (
      <div className="numa-panel-strong space-y-4 p-5">
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          {account.name} är arkiverat. Historiken är kvar, men kontot syns inte
          i aktiva listor eller när du skapar en ny utgift.
        </p>
        {error ? (
          <p
            className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_14%,transparent)] px-3 py-2.5 text-sm text-[var(--numa-danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onRestore}
          className="numa-btn numa-btn-accent min-h-14 w-full text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Återställer…" : "Återställ konto"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="numa-panel-strong space-y-4 p-5">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Typ av konto
        </span>
        <select
          value={form.kind}
          onChange={(e) => onKindChange(e.target.value as AccountKind)}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        >
          {ACCOUNT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ACCOUNT_KIND_LABEL_SV[kind]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--numa-faint)]">
          Typen styr vilka valutor som går. Namn och typ ändrar inte historik
          eller saldo.
        </p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Namn
        </span>
        <input
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--numa-faint)]">
          Namnet syns i listor och när en utgift skapas.
        </p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Valuta
        </span>
        <select
          value={form.currency}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              currency: e.target.value as CurrencyCode,
            }))
          }
          disabled={currencyLocked || allowedCurrencies.length === 1}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25 disabled:opacity-70"
        >
          {(currencyLocked ? [form.currency] : allowedCurrencies).map((code) => (
            <option key={code} value={code}>
              {currencyLabel(code)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--numa-faint)]">
          {currencyLocked
            ? CURRENCY_LOCKED_SV
            : "Valuta kan ändras bara innan kontot fått transaktioner. Historisk växelkurs och THB påverkas inte."}
        </p>
      </label>

      <label className="numa-press flex min-h-11 items-start gap-3 rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 py-3 transition hover:border-[var(--numa-border-strong)] focus-within:ring-2 focus-within:ring-[var(--numa-accent)]/25">
        <input
          type="checkbox"
          checked={form.makeDefault}
          disabled={account.isDefault}
          onChange={(e) =>
            setForm((current) => ({ ...current, makeDefault: e.target.checked }))
          }
          className="mt-1 h-4 w-4 accent-[var(--numa-accent)]"
        />
        <span className="text-sm leading-relaxed text-[var(--numa-muted)]">
          <span className="block font-medium text-[var(--numa-ink)]">
            {DEFAULT_ACCOUNT_COPY_SV}
          </span>
          <span className="mt-1 block text-xs text-[var(--numa-faint)]">
            {DEFAULT_ACCOUNT_HELP_SV}
            {account.isDefault
              ? " Välj förvalt på ett annat konto först om du vill byta."
              : ""}
          </span>
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
        disabled={pending || !form.name.trim()}
        className="numa-btn numa-btn-accent min-h-14 w-full text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
      >
        {pending && confirm == null ? "Sparar…" : "Spara ändringar"}
      </button>

      {account.isDefault ? (
        <div className="space-y-2 border-t border-[var(--numa-border)] pt-4">
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            {CHOOSE_OTHER_DEFAULT_SV} {DEFAULT_ACCOUNT_BLOCK_SV}
          </p>
        </div>
      ) : account.hasLedgerHistory ? (
        <div className="space-y-2 border-t border-[var(--numa-border)] pt-4">
          {confirm === "archive" ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                Arkivera {account.name}? Historiken sparas, men kontot döljs från
                aktiva listor och nya utgifter. Saldo måste vara 0.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={onArchive}
                className="numa-btn min-h-14 w-full bg-[var(--numa-danger-soft)] text-[var(--numa-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-danger)] focus-visible:ring-offset-2"
              >
                {pending ? "Arkiverar…" : "Ja, arkivera konto"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(null)}
                className="numa-btn numa-btn-soft min-h-14 w-full"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setConfirm("archive");
                }}
                className="numa-btn numa-btn-soft min-h-14 w-full"
              >
                Arkivera konto
              </button>
              <p className="text-xs leading-relaxed text-[var(--numa-faint)]">
                Konton med historik kan inte raderas. Flytta eller töm saldot till
                0 innan du arkiverar.
              </p>
            </>
          )}
        </div>
      ) : account.calculatedMinor === 0 ? (
        <div className="space-y-2 border-t border-[var(--numa-border)] pt-4">
          {confirm === "delete" ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                Radera {account.name}? Det går inte att ångra. Inga transaktioner
                finns på kontot, och saldot är 0.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={onDelete}
                className="numa-btn min-h-14 w-full bg-[var(--numa-danger-soft)] text-[var(--numa-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-danger)] focus-visible:ring-offset-2"
              >
                {pending ? "Raderar…" : "Ja, radera konto"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(null)}
                className="numa-btn numa-btn-soft min-h-14 w-full"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setConfirm("delete");
              }}
              className="numa-btn numa-btn-soft min-h-14 w-full text-[var(--numa-danger)]"
            >
              Radera konto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t border-[var(--numa-border)] pt-4">
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            {account.calculatedMinor == null
              ? DELETE_UNKNOWN_SALDO_SV
              : DELETE_REQUIRES_ZERO_SV}
          </p>
        </div>
      )}
    </form>
  );
}
