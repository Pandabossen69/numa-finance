"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_TIMEZONE, formatListDateSv, newClientMutationId } from "@/domain/finance";
import { formatMoney, money } from "@/domain/money";
import type { CapturePreview } from "@/features/imports/capture-preview";
import { confirmBankMailAction } from "@/features/imports/bank-mail-actions";
import { BANK_MAIL_SOURCE_LABEL } from "@/features/imports/bank-mail-label";
import { goHomeInstant } from "@/lib/nav/instant";

export function BankMailConfirm({
  preview,
  accounts,
}: {
  preview: CapturePreview | null;
  accounts: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!preview || preview.importKind !== "bank_mail") {
    return (
      <div className="animate-rise space-y-4">
        <p className="text-lg font-semibold tracking-tight">Hämtar betalningen…</p>
        <p className="text-sm text-[var(--numa-muted)]">{BANK_MAIL_SOURCE_LABEL}</p>
      </div>
    );
  }

  const accountName =
    accounts.find((account) => account.id === preview.preselectedAccountId)?.name ??
    preview.accountName ??
    "Konto";
  const amountMinor = preview.events[0]?.amountMinor ?? null;
  const when = preview.occurredAt
    ? formatListDateSv(preview.occurredAt, DEFAULT_TIMEZONE, { withTime: true })
    : null;

  function onConfirm() {
    if (!preview || preview.alreadyKnown) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmBankMailAction({
        observationId: preview.observationId,
        clientMutationId: newClientMutationId(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goHomeInstant(router);
    });
  }

  return (
    <div className="animate-rise space-y-7">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
        {preview.sourceLabel ?? BANK_MAIL_SOURCE_LABEL}
      </p>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight text-[var(--numa-ink)]">
          {preview.description || "Betalning"}
        </p>
        {preview.isWalletTopUp ? (
          <p className="text-sm text-[var(--numa-muted)]">Påfyllning av e-plånbok</p>
        ) : null}
        {amountMinor != null ? (
          <p className="money text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
            −{formatMoney(money(amountMinor, preview.currency))}
          </p>
        ) : null}
        {when ? <p className="text-sm text-[var(--numa-muted)]">{when}</p> : null}
        <p className="text-sm text-[var(--numa-muted)]">{accountName}</p>
      </div>

      {preview.alreadyKnown ? (
        <p className="text-sm text-[var(--numa-muted)]">Den här betalningen är redan sparad.</p>
      ) : (
        <button
          type="button"
          disabled={pending || amountMinor == null}
          onClick={onConfirm}
          className="numa-btn numa-btn-primary w-full rounded-full"
        >
          {pending ? "Sparar…" : "Bekräfta"}
        </button>
      )}

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <Link
        href="/importera"
        className="numa-press inline-flex min-h-11 items-center text-sm font-semibold text-[var(--numa-accent)]"
      >
        Tillbaka
      </Link>
    </div>
  );
}
