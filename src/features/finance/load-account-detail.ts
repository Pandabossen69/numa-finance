import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  ACCOUNT_KIND_LABEL_SV,
  accountHasLedgerHistory,
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
  type Account,
  type AccountKind,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";
import {
  getAccount,
  getLatestCheckpoint,
  listAccounts,
  listTransactions,
} from "@/lib/store/repository";

export type AccountDetail = {
  id: string;
  name: string;
  kind: AccountKind;
  kindLabelSv: string;
  currency: CurrencyCode;
  isDefault: boolean;
  isActive: boolean;
  calculatedMinor: number | null;
  hasLedgerHistory: boolean;
  activeCount: number;
};

export type AccountDetailResult =
  | { ok: true; data: AccountDetail }
  | { ok: false; error: string; notFound?: boolean };

function toDetail(
  account: Account,
  activeCount: number,
  checkpoint: Awaited<ReturnType<typeof getLatestCheckpoint>>,
  transactions: Awaited<ReturnType<typeof listTransactions>>,
): AccountDetail {
  const after = filterTransactionsAfterCheckpoint(
    transactions.filter((tx) => tx.status !== "voided"),
    checkpoint,
  );
  let calculatedMinor: number | null = null;
  if (checkpoint) {
    try {
      calculatedMinor =
        calculateAccountBalance({
          checkpoint,
          transactionsAfterCheckpoint: after,
        })?.amountMinor ?? null;
    } catch (error) {
      console.error("[numa] account detail balance calc failed", error);
    }
  }
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    kindLabelSv: ACCOUNT_KIND_LABEL_SV[account.kind],
    currency: account.currency,
    isDefault: account.isDefault,
    isActive: account.isActive,
    calculatedMinor,
    hasLedgerHistory: accountHasLedgerHistory(transactions),
    activeCount,
  };
}

export const loadAccountDetail = cache(
  async (accountId: string): Promise<AccountDetailResult> => {
    try {
      const account = await getAccount(accountId);
      if (!account) {
        return { ok: false, error: "Kontot hittades inte", notFound: true };
      }
      const [active, checkpoint, transactions] = await Promise.all([
        listAccounts(),
        getLatestCheckpoint(account.id),
        listTransactions(account.id),
      ]);
      return {
        ok: true,
        data: toDetail(account, active.length, checkpoint, transactions),
      };
    } catch (error) {
      unstable_rethrow(error);
      console.error("[numa] loadAccountDetail failed", error);
      void reportError("loader.accounts", error);
      return {
        ok: false,
        error: loadErrorMessageSv(error, "Kunde inte hämta kontot"),
      };
    }
  },
);
