"use client";

import { useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_TIMEZONE, formatListDateSv, newClientMutationId } from "@/domain/finance";
import { formatMoney, money } from "@/domain/money";
import type { CapturePreview } from "@/features/imports/capture-preview";
import {
  confirmBankMailAction,
  rejectBankMailAction,
} from "@/features/imports/bank-mail-actions";
import {
  BANK_MAIL_SOURCE_LABEL,
  bankMailAccountLabel,
} from "@/features/imports/bank-mail-label";
import { bankMailConfirmBlockedMessage } from "@/features/imports/bank-mail-notices";
import { refreshAfterBankMailQueueChange } from "@/features/imports/bank-mail-queue-refresh";
import { applyOptimisticHomeSpend } from "@/features/home/last-snapshot";
import {
  bankMailSavedToast,
  publishBankMailSavedToast,
} from "@/features/imports/bank-mail-toast";
import { goHomeInstant, goImporteraInstant } from "@/lib/nav/instant";

export function BankMailConfirm({
  preview,
  accounts,
}: {
  preview: CapturePreview | null;
  accounts: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"confirm" | "reject" | "left" | null>(null);
  const [pending, startTransition] = useTransition();

  if (!preview || preview.importKind !== "bank_mail") {
    return (
      <div className="animate-rise space-y-4">
        <p className="text-lg font-semibold tracking-tight">Hämtar betalningen…</p>
        <p className="text-sm text-[var(--numa-muted)]">{BANK_MAIL_SOURCE_LABEL}</p>
      </div>
    );
  }

  const matched = accounts.find((account) => account.id === preview.preselectedAccountId);
  const accountName = bankMailAccountLabel({
    liveName: matched?.name,
    storedName: preview.accountName,
  });
  const amountMinor = preview.events[0]?.amountMinor ?? null;
  const when = preview.occurredAt
    ? formatListDateSv(preview.occurredAt, DEFAULT_TIMEZONE, { withTime: true })
    : null;
  const blockedMessage = bankMailConfirmBlockedMessage({
    occurredAt: preview.occurredAt,
    openingBalanceAt: preview.openingBalanceAt,
  });
  const blocked = blockedMessage != null;
  const amountLabel =
    amountMinor != null
      ? `−${formatMoney(money(amountMinor, preview.currency))}`
      : null;

  function onConfirm() {
    if (!preview || preview.alreadyKnown || blocked) return;
    setError(null);
    setMode("confirm");
    startTransition(async () => {
      const result = await confirmBankMailAction({
        observationId: preview.observationId,
        clientMutationId: newClientMutationId(),
        accountId: preview.preselectedAccountId ?? undefined,
      });
      if (!result.ok) {
        setError(result.error);
        setMode(null);
        return;
      }
      // Paint the toast before Hem. Navigation in this transition waits
      // for Hem's RSC and holds the ack on a slow database.
      flushSync(() => {
        if (amountMinor != null) applyOptimisticHomeSpend(amountMinor);
        if (amountLabel) {
          publishBankMailSavedToast(
            bankMailSavedToast({
              merchant: preview.description || "Betalning",
              amountLabel,
              accountName,
            }),
          );
        }
      });
      const observationId = preview.observationId;
      setTimeout(() => {
        goHomeInstant(router);
        void refreshAfterBankMailQueueChange(
          observationId,
          "Bekräftad och sparad",
        );
      }, 0);
    });
  }

  function onReject() {
    if (!preview || preview.alreadyKnown) return;
    setError(null);
    setMode("reject");
    startTransition(async () => {
      const result = await rejectBankMailAction({
        observationId: preview.observationId,
      });
      if (!result.ok) {
        setError(result.error);
        setMode(null);
        return;
      }
      const observationId = preview.observationId;
      // Paint the end of «Avvisar…» before the hop. The keep-alive panel
      // shows the client queue in the same turn; router.push would wait
      // for /importera’s RSC and leave this card up.
      flushSync(() => {
        setMode("left");
      });
      setTimeout(() => {
        goImporteraInstant(router);
        void refreshAfterBankMailQueueChange(observationId, "Avvisad");
      }, 0);
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
        {blockedMessage ? (
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {blockedMessage}
          </p>
        ) : null}
      </div>

      {preview.alreadyKnown ? (
        <p className="text-sm text-[var(--numa-muted)]">Den här betalningen är redan sparad.</p>
      ) : mode === "left" ? null : (
        <div className="space-y-3">
          {blocked ? null : (
            <button
              type="button"
              disabled={pending || amountMinor == null}
              onClick={onConfirm}
              className="numa-btn numa-btn-primary w-full rounded-full"
            >
              {pending && mode === "confirm" ? "Sparar…" : "Bekräfta"}
            </button>
          )}
          <button
            type="button"
            disabled={mode === "reject"}
            onClick={onReject}
            className="numa-press flex min-h-11 w-full items-center justify-center text-sm font-semibold text-[var(--numa-danger)]"
          >
            {mode === "reject" ? "Avvisar…" : "Avvisa"}
          </button>
        </div>
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
