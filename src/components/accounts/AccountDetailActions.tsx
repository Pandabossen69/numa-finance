"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ManageAccountForm } from "@/components/accounts/ManageAccountForm";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { SV } from "@/features/copy/labels-sv";
import type { AccountDetail } from "@/features/finance/load-account-detail";
import {
  paintableAccountsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";
import { serverNull } from "@/lib/react/server-snapshot";

function useListedBalance(accountId: string): number | null {
  const snapshot = useSyncExternalStore(
    subscribeAccountsSnapshot,
    paintableAccountsSnapshot,
    serverNull,
  );
  if (!snapshot) return null;
  const row =
    snapshot.accounts.find((account) => account.id === accountId) ??
    snapshot.archivedAccounts?.find((account) => account.id === accountId);
  return row?.calculatedMinor ?? null;
}

/**
 * Secondary actions on the account detail screen.
 * The balance follows the Konton snapshot (and the save we just confirmed)
 * so a soft nav does not keep the RSC number the page was loaded with.
 */
export function AccountDetailActions({ account }: { account: AccountDetail }) {
  const [panel, setPanel] = useState<"saldo" | "hantera" | null>(null);
  const [savedMinor, setSavedMinor] = useState<number | null>(null);
  const [toast, setToast] = useState(false);
  const listed = useListedBalance(account.id);
  const amountMinor = savedMinor ?? listed ?? account.calculatedMinor;

  function toggle(next: "saldo" | "hantera") {
    setPanel((current) => (current === next ? null : next));
  }

  function onSaved(balanceMinor: number) {
    setSavedMinor(balanceMinor);
    setPanel(null);
    setToast(true);
  }

  return (
    <div className="space-y-4">
      <p className="text-[var(--numa-ink)]" data-account-balance="">
        {amountMinor != null ? (
          <MoneyDisplay
            amountMinor={amountMinor}
            currency={account.currency}
            size="lg"
            tone="neutral"
            align="start"
            wrap={false}
          />
        ) : (
          <span className="text-sm text-[var(--numa-faint)]">—</span>
        )}
      </p>
      {account.isActive ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="numa-btn numa-btn-soft min-h-11"
              aria-expanded={panel === "saldo"}
              onClick={() => toggle("saldo")}
            >
              Uppdatera saldo
            </button>
            <button
              type="button"
              className="numa-btn numa-btn-soft min-h-11"
              aria-expanded={panel === "hantera"}
              aria-label={`Hantera ${account.name}`}
              onClick={() => toggle("hantera")}
            >
              Hantera
            </button>
          </div>
          {panel === "saldo" ? (
            <VerifyBalanceForm
              accountId={account.id}
              currency={account.currency}
              onSaved={onSaved}
            />
          ) : null}
          {panel === "hantera" ? <ManageAccountForm account={account} /> : null}
        </>
      ) : (
        <ManageAccountForm account={account} />
      )}
      {toast && typeof document !== "undefined"
        ? createPortal(
            <p
              role="status"
              className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] mx-auto w-fit rounded-full border border-[var(--numa-border)] bg-[var(--numa-card)] px-4 py-2.5 text-sm font-medium text-[var(--numa-ink)]"
            >
              {SV.sparat}
            </p>,
            document.body,
          )
        : null}
    </div>
  );
}
