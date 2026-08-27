"use client";

import { useState, useTransition } from "react";
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
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount.trim() || pending) return;
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
      <div className="space-y-6 md:rounded-[1.75rem] md:border md:border-[var(--numa-border-strong)] md:bg-[var(--numa-surface-solid)] md:p-8 md:shadow-[var(--numa-shadow)]">
        <div className="space-y-3">
          <Link
            href={ONBOARDING_SALDO_PATH}
            className="numa-press inline-flex min-h-11 items-center text-sm font-semibold text-[var(--numa-accent)] transition hover:text-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
          >
            ← {C.back}
          </Link>
          <header className="space-y-2">
            <p className="numa-section-title">{C.saldoEyebrow}</p>
            <h1 className="numa-page-title">{C.saldoTitle}</h1>
          </header>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
              {C.amountLabel}
            </span>
            <input
              inputMode="decimal"
              autoFocus
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder={currency}
              className="money min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 text-lg font-semibold outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
              {C.accountNameLabel}
            </span>
            <input
              type="text"
              maxLength={80}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={C.accountNamePlaceholder}
              className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 text-base outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
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
          className="numa-btn numa-btn-primary min-h-14 w-full rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
        >
          {pending ? "Sparar…" : C.saveSaldo}
        </button>
      </div>
    </form>
  );
}
