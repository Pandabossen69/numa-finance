"use client";

import { useState, useTransition } from "react";
import { useSubmitGuard } from "@/lib/forms/submit-guard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAvailableNowAction } from "@/features/finance/actions";
import { ONBOARDING_SV as C } from "@/features/onboarding/copy";
import {
  HOME_PATH,
  ONBOARDING_SALDO_PATH,
} from "@/features/onboarding/paths";
import type { CurrencyCode } from "@/domain/money";

export function OnboardingManualSaldo({
  currency,
}: {
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const guard = useSubmitGuard(pending);
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount.trim() || pending) return;
    if (!guard.tryBegin()) return;
    setError(null);
    startTransition(async () => {
      const result = await setAvailableNowAction({
        balance: amount,
        currency,
        accountName: accountName.trim() || null,
        fromOnboarding: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(HOME_PATH);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col animate-rise md:mx-auto md:w-full md:max-w-lg md:flex-none"
    >
      <div className="space-y-7 md:rounded-[2rem] md:border md:border-[var(--numa-border-strong)] md:bg-[var(--numa-surface-solid)] md:p-8 md:shadow-[var(--numa-shadow)]">
        <div className="space-y-3.5">
          <Link
            href={ONBOARDING_SALDO_PATH}
            className="numa-press inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
          >
            ← {C.back}
          </Link>
          <header className="space-y-2.5">
            <p className="numa-section-title">{C.saldoEyebrow}</p>
            <h1 className="numa-page-title">{C.saldoTitle}</h1>
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
              {C.manualEntryHint}
            </p>
          </header>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2.5 block text-[12px] font-semibold tracking-[0.06em] text-[var(--numa-muted)] uppercase">
              {C.amountLabel}
            </span>
            <span className="relative block">
              <input
                inputMode="decimal"
                autoFocus
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0,00"
                className="money min-h-[4.5rem] w-full rounded-[1.35rem] border border-[var(--numa-border-strong)] bg-[var(--numa-card)] px-4 pr-20 text-[1.8rem] font-bold tracking-[-0.04em] outline-none transition placeholder:text-[var(--numa-faint)]/55 focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/20"
              />
              <span className="money-currency pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[11px] font-semibold text-[var(--numa-faint)]">
                {currency}
              </span>
            </span>
          </label>
          <label className="block">
            <span className="mb-2.5 block text-[12px] font-semibold tracking-[0.06em] text-[var(--numa-muted)] uppercase">
              {C.accountNameLabel}
            </span>
            <input
              type="text"
              maxLength={80}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={C.accountNamePlaceholder}
              className="min-h-14 w-full rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 text-base outline-none transition placeholder:text-[var(--numa-faint)] focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/20"
            />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-auto pt-6 md:mt-6 md:pt-0">
        <button
          type="submit"
          disabled={pending || !amount.trim()}
          className="numa-btn numa-btn-primary min-h-14 w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Sparar…" : C.saveSaldo}
        </button>
      </div>
    </form>
  );
}
