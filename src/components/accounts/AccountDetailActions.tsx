"use client";

import { useState } from "react";
import { ManageAccountForm } from "@/components/accounts/ManageAccountForm";
import { VerifyBalanceForm } from "@/components/accounts/VerifyBalanceForm";
import type { AccountDetail } from "@/features/finance/load-account-detail";

/**
 * Secondary actions on the account detail screen.
 * The list itself is only a row — saldo and manage live here.
 */
export function AccountDetailActions({ account }: { account: AccountDetail }) {
  const [panel, setPanel] = useState<"saldo" | "hantera" | null>(null);

  function toggle(next: "saldo" | "hantera") {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="space-y-4">
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
        <VerifyBalanceForm accountId={account.id} currency={account.currency} />
      ) : null}
      {panel === "hantera" ? <ManageAccountForm account={account} /> : null}
    </div>
  );
}
