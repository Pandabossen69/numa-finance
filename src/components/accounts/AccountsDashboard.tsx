"use client";

import { useEffect, useSyncExternalStore } from "react";
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
        title="Saldo"
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
                Inga saldon ännu. Snabbast är att fota bank-SMS.
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
          {view.accounts.map((account) => (
            <MerSection key={account.id}>
              <MerListGroup>
                <MerListRow className="flex items-center gap-3">
                  <MerIcon tone={account.isDefault ? "positive" : "neutral"}>
                    <IconWallet />
                  </MerIcon>
                  <div className="numa-money-line min-w-0 flex-1 items-start">
                    <div className="numa-money-line-label">
                      <h2 className="truncate text-[15px] font-semibold tracking-tight">
                        {account.name}
                        {account.maskedIdentifier
                          ? ` ·${account.maskedIdentifier}`
                          : ""}
                      </h2>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--numa-faint)]">
                        {account.institution ?? "Eget konto"} · {account.currency}
                        {account.isDefault ? (
                          <span className="numa-chip numa-chip-mint ml-1.5 align-middle">
                            Standard
                          </span>
                        ) : null}
                      </p>
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
                  <VerifyBalanceForm accountId={account.id} />
                </MerListRow>
              </MerListGroup>
            </MerSection>
          ))}
        </div>
      )}
    </div>
  );
}
