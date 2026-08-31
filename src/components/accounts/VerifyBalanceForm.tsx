"use client";

import { useState, useTransition } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import { createCheckpointAction } from "@/features/finance/actions";
import { parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";
import { applyAccountBalance } from "@/features/home/last-snapshot";

export function VerifyBalanceForm({
  accountId,
  currency = "THB",
}: {
  accountId: string;
  currency?: CurrencyCode;
}) {
  const [balance, setBalance] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);
  const needsFx = currency !== "THB";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      let balanceMinor: number;
      try {
        balanceMinor = parseUiAmountToMinor(balance);
      } catch {
        setError("Ogiltigt belopp");
        return;
      }
      const result = await createCheckpointAction({
        accountId,
        balance,
        source: "manual_verification",
        fxRate: needsFx ? fxRate || null : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      applyAccountBalance(accountId, balanceMinor, {
        thbMinor:
          result.thbMinor ??
          (currency === "THB" ? balanceMinor : undefined),
        currency,
      });
      setBalance("");
      setFxRate("");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Hur mycket har du just nu? ({currency})
        </span>
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          inputMode="decimal"
          placeholder="t.ex. 10058,04"
          className="money min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3.5 text-base font-semibold outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
      </label>
      {needsFx ? (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
            Växelkurs (THB per 1 {currency})
          </span>
          <input
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
            inputMode="decimal"
            placeholder="Tomt = marknadspris"
            className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3.5 text-base outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
          />
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !balance.trim()}
        className="numa-btn numa-btn-soft w-full"
      >
        {pending ? "Sparar…" : "Spara saldo"}
      </button>
    </form>
  );
}
