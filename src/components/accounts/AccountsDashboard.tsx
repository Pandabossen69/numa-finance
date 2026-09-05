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
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
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

      {view.accounts.length === 0 &&
      (view.archivedAccounts ?? []).length === 0 ? (
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
                              Förvalt
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
                          className="min-h-11 text-[13px] font-semibold text-[var(--numa-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
                          onClick={() => setOpenVerifyId(null)}
                        >
                          Stäng
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          className="numa-btn numa-btn-soft w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
                          onClick={() => setOpenVerifyId(account.id)}
                        >
                          Uppdatera saldo
                        </button>
                        <Link
                          href={`/konton/${account.id}`}
                          prefetch
                          onMouseEnter={() => prefetch(`/konton/${account.id}`)}
                          onFocus={() => prefetch(`/konton/${account.id}`)}
                          aria-label={`Hantera ${account.name}`}
                          className="numa-btn numa-btn-soft w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
                        >
                          Hantera
                        </Link>
                      </div>
                    )}
                  </MerListRow>
                </MerListGroup>
              </MerSection>
            );
          })}

          {(view.archivedAccounts ?? []).length > 0 ? (
            <MerSection title="Arkiverade konton" className="pt-2">
              <MerListGroup>
                {(view.archivedAccounts ?? []).map((account) => (
                  <MerListRow key={account.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-tight">
                        {account.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--numa-faint)]">
                        {account.kindLabelSv} · {account.currency} · historik sparad
                      </p>
                    </div>
                    <Link
                      href={`/konton/${account.id}`}
                      prefetch
                      onMouseEnter={() => prefetch(`/konton/${account.id}`)}
                      onFocus={() => prefetch(`/konton/${account.id}`)}
                      aria-label={`Återställ eller hantera ${account.name}`}
                      className="numa-btn numa-btn-soft min-h-11 shrink-0 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
                    >
                      Återställ
                    </Link>
                  </MerListRow>
                ))}
              </MerListGroup>
            </MerSection>
          ) : null}
        </div>
      )}
    </div>
  );
}
