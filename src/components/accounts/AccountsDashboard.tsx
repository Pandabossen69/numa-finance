"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AccountsViewLoading } from "@/components/accounts/AccountsViewLoading";
import {
  MerListGroup,
  MerListRow,
  MerPageHeader,
  MerSection,
} from "@/components/mer/MerHub";
import { Icon } from "@/components/ui/Icon";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import {
  accountEditError,
  subscribeAccountEditError,
} from "@/features/finance/account-edit-store";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  isAccountsDirty,
  paintableAccountsSnapshot,
  rememberAccountsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";
import { SV } from "@/features/copy/labels-sv";
import { usePrefetchOnIntent } from "@/lib/nav/prefetch-intent";
import { serverNull } from "@/lib/react/server-snapshot";

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
    paintableAccountsSnapshot,
    serverNull,
  );

  useEffect(() => {
    if (!data) return;
    if (isAccountsDirty()) return;
    if (paintableAccountsSnapshot()) return;
    rememberAccountsSnapshot(data);
  }, [data]);

  const editError = useSyncExternalStore(
    subscribeAccountEditError,
    accountEditError,
    () => null,
  );
  const view = stored ?? data;

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

      {editError ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_14%,transparent)] px-3 py-2.5 text-sm text-[var(--numa-danger)]"
          role="alert"
        >
          {editError}
        </p>
      ) : null}

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
        <div className="animate-rise-delay-1 space-y-4">
          {view.totalThbMinor != null ? (
            <MerSection>
              <MerListGroup>
                <MerListRow className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--numa-faint)]">
                      Totalt i THB
                    </p>
                    <MoneyDisplay
                      amountMinor={view.totalThbMinor}
                      currency="THB"
                      size="md"
                      compact
                      tone="neutral"
                      wrap={false}
                    />
                  </div>
                  <p className="text-[13px] text-[var(--numa-muted)]">
                    {SV.saldoAllaKontonHint}
                  </p>
                </MerListRow>
              </MerListGroup>
            </MerSection>
          ) : null}

          <MerSection>
            <MerListGroup>
              {view.accounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/konton/${account.id}`}
                  prefetch
                  onMouseEnter={() => prefetch(`/konton/${account.id}`)}
                  onFocus={() => prefetch(`/konton/${account.id}`)}
                  aria-label={`${account.name}, öppna konto`}
                  className="numa-press flex min-h-14 items-center gap-3 border-b border-[var(--numa-border)] px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold tracking-tight text-[var(--numa-ink)]">
                      {account.name}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--numa-faint)]">
                      <span className="truncate">
                        {account.kindLabelSv} · {account.currency}
                      </span>
                      {account.isDefault ? (
                        <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-[var(--numa-border-strong)] px-2 text-[11px] font-medium tracking-normal text-[var(--numa-muted)] normal-case">
                          Förvalt
                        </span>
                      ) : null}
                    </span>
                    {account.currency !== "THB" &&
                    account.thbMinor != null &&
                    account.calculatedMinor != null ? (
                      <span className="mt-1 block text-[12px] text-[var(--numa-muted)]">
                        ≈{" "}
                        <MoneyDisplay
                          amountMinor={account.thbMinor}
                          currency="THB"
                          size="sm"
                          tone="neutral"
                          wrap={false}
                        />
                        {account.fxRate != null ? ` · kurs ${account.fxRate}` : null}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[var(--numa-ink)]">
                    {account.calculatedMinor != null ? (
                      <MoneyDisplay
                        amountMinor={account.calculatedMinor}
                        currency={account.currency}
                        size="md"
                        compact
                        tone="neutral"
                        wrap={false}
                      />
                    ) : (
                      <span className="text-sm text-[var(--numa-faint)]">—</span>
                    )}
                  </span>
                  <Icon icon={ChevronRight} className="shrink-0 text-[var(--numa-faint)]" />
                </Link>
              ))}
            </MerListGroup>
          </MerSection>

          {(view.archivedAccounts ?? []).length > 0 ? (
            <details className="numa-panel-list">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium text-[var(--numa-ink)] [&::-webkit-details-marker]:hidden">
                <span>Arkiverade ({(view.archivedAccounts ?? []).length})</span>
                <Icon icon={ChevronDown} className="text-[var(--numa-faint)]" />
              </summary>
              {(view.archivedAccounts ?? []).map((account) => (
                <Link
                  key={account.id}
                  href={`/konton/${account.id}`}
                  prefetch
                  onMouseEnter={() => prefetch(`/konton/${account.id}`)}
                  onFocus={() => prefetch(`/konton/${account.id}`)}
                  aria-label={`Återställ eller hantera ${account.name}`}
                  className="numa-press flex min-h-14 items-center gap-3 border-t border-[var(--numa-border)] px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold tracking-tight">
                      {account.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--numa-faint)]">
                      {account.kindLabelSv} · {account.currency} · historik sparad
                    </span>
                  </span>
                  <Icon icon={ChevronRight} className="shrink-0 text-[var(--numa-faint)]" />
                </Link>
              ))}
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
