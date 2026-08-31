"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import { AccountsViewLoading } from "@/components/accounts/AccountsViewLoading";
import {
  IconWallet,
  MerIcon,
  MerListGroup,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import { archiveAccountAction } from "@/features/finance/actions";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  applyAccountRemoved,
  isAccountsDirty,
  lastAccountsSnapshot,
  rememberAccountsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";

export function AccountsDashboard({
  data,
  error,
}: {
  data: AccountsSnapshot | null;
  error?: string | null;
}) {
  const { prefetch } = usePrefetchOnIntent();
  const [openVerifyId, setOpenVerifyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const stored = useSyncExternalStore(
    subscribeAccountsSnapshot,
    lastAccountsSnapshot,
    lastAccountsSnapshot,
  );

  useEffect(() => {
    if (!data) return;
    if (lastAccountsSnapshot() == null || !isAccountsDirty()) {
      rememberAccountsSnapshot(data);
    }
  }, [data]);

  const view = stored ?? data ?? lastAccountsSnapshot();

  async function removeAccount(accountId: string) {
    if (!view) return;
    if (view.accounts.length <= 1) {
      setDeleteError("Lägg till ett annat konto först");
      return;
    }
    const previous = view;
    setDeletingId(accountId);
    setDeleteError(null);
    applyAccountRemoved(accountId);
    const result = await archiveAccountAction(accountId);
    if (!result.ok) {
      rememberAccountsSnapshot(previous);
      setDeleteError(result.error);
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  if (!view) {
    if (!error) return <AccountsViewLoading />;
    return (
      <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-3">
        <p className="font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <RetryLoadButton />
      </div>
    );
  }

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <MerPageHeader
        back
        title="Konton"
        action={
          <Link
            href="/konton/ny"
            prefetch
            onMouseEnter={() => prefetch("/konton/ny")}
            onFocus={() => prefetch("/konton/ny")}
            className="numa-tap text-[13px] font-semibold text-[var(--numa-accent)]"
          >
            Nytt konto
          </Link>
        }
      />

      {view.accounts.length === 0 ? (
        <MerSection className="animate-rise-delay-1">
          <MerListGroup>
            <MerListRow className="space-y-3 py-5">
              <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
                Inga konton ännu. Snabbast är att fota bank-SMS via +.
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold">
                <Link
                  href="/fota?mode=sms"
                  prefetch
                  onMouseEnter={() => prefetch("/fota?mode=sms")}
                  onFocus={() => prefetch("/fota?mode=sms")}
                  className="numa-tap text-[var(--numa-accent)]"
                >
                  Fota bank-SMS →
                </Link>
                <Link
                  href="/konton/ny"
                  prefetch
                  onMouseEnter={() => prefetch("/konton/ny")}
                  onFocus={() => prefetch("/konton/ny")}
                  className="numa-tap text-[var(--numa-accent)]"
                >
                  Ange manuellt →
                </Link>
              </div>
            </MerListRow>
          </MerListGroup>
        </MerSection>
      ) : (
        <div className="animate-rise-delay-1 space-y-6">
          {view.totalThbMinor != null ? (
            <MerSection>
              <MerListGroup>
                <MerListRow className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--numa-faint)]">
                      Totalt
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--numa-muted)]">
                      Det du äger — Hem och Plan använder detta
                    </p>
                  </div>
                  <MoneyDisplay
                    amountMinor={view.totalThbMinor}
                    currency="THB"
                    size="md"
                    wrap={false}
                  />
                </MerListRow>
              </MerListGroup>
            </MerSection>
          ) : null}

          {view.accounts.map((account) => {
            const open = openVerifyId === account.id;
            return (
              <MerSection key={account.id}>
                <MerListGroup>
                  <MerListRow className="flex items-center gap-3">
                    <MerIcon tone={account.isDefault ? "positive" : "neutral"}>
                      <IconWallet />
                    </MerIcon>
                    <div className="numa-money-line min-w-0 flex-1 items-start">
                      <div className="numa-money-line-label min-w-0">
                        <h2 className="truncate text-[15px] font-semibold tracking-tight">
                          {account.name}
                        </h2>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-[var(--numa-faint)]">
                          <span>
                            {account.kindLabelSv} · {account.currency}
                          </span>
                          {account.isDefault ? (
                            <span className="numa-chip numa-chip-mint align-middle">
                              Primär
                            </span>
                          ) : null}
                        </p>
                        {account.currency !== "THB" &&
                        account.thbMinor != null &&
                        account.calculatedMinor != null ? (
                          <p className="mt-1 text-[12px] text-[var(--numa-muted)]">
                            ≈{" "}
                            <MoneyDisplay
                              amountMinor={account.thbMinor}
                              currency="THB"
                              size="sm"
                              wrap={false}
                            />
                            {account.fxRate != null
                              ? ` · kurs ${account.fxRate}`
                              : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="numa-money-line-amt">
                        {account.calculatedMinor != null ? (
                          <MoneyDisplay
                            amountMinor={account.calculatedMinor}
                            currency={account.currency}
                            size="md"
                            wrap={false}
                          />
                        ) : (
                          <span className="text-sm text-[var(--numa-faint)]">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  </MerListRow>
                  <MerListRow className="bg-[var(--numa-bg)]/35">
                    {open ? (
                      <div className="space-y-2">
                        <VerifyBalanceForm
                          accountId={account.id}
                          currency={account.currency}
                        />
                        <button
                          type="button"
                          className="text-[13px] font-semibold text-[var(--numa-muted)]"
                          onClick={() => setOpenVerifyId(null)}
                        >
                          Stäng
                        </button>
                      </div>
                    ) : confirmDeleteId === account.id ? (
                      <div className="space-y-2">
                        <p className="text-sm text-[var(--numa-muted)]">
                          Ta bort {account.name}? Rörelserna stannar i historiken.
                        </p>
                        {view.accounts.length <= 1 ? (
                          <p className="text-sm text-[var(--numa-danger)]">
                            Lägg till ett annat konto först
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={
                              deletingId === account.id ||
                              view.accounts.length <= 1
                            }
                            className="numa-btn numa-btn-soft flex-1 text-[var(--numa-danger)]"
                            onClick={() => void removeAccount(account.id)}
                          >
                            {deletingId === account.id
                              ? "Tar bort…"
                              : "Ta bort"}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === account.id}
                            className="text-[13px] font-semibold text-[var(--numa-muted)]"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          className="numa-btn numa-btn-soft flex-1"
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setOpenVerifyId(account.id);
                          }}
                        >
                          Uppdatera saldo
                        </button>
                        <button
                          type="button"
                          className="numa-btn numa-btn-soft flex-1 text-[var(--numa-danger)]"
                          onClick={() => {
                            setOpenVerifyId(null);
                            setDeleteError(null);
                            setConfirmDeleteId(account.id);
                          }}
                        >
                          Ta bort
                        </button>
                      </div>
                    )}
                    {deleteError && confirmDeleteId === account.id ? (
                      <p className="mt-2 text-sm text-[var(--numa-danger)]">
                        {deleteError}
                      </p>
                    ) : null}
                  </MerListRow>
                </MerListGroup>
              </MerSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
