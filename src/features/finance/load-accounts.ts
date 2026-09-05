import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  ACCOUNT_KIND_LABEL_SV,
  balanceToThbMinor,
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
  type AccountKind,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";
import {
  getLatestCheckpoint,
  listAccounts,
  listArchivedAccounts,
  listTransactions,
} from "@/lib/store/repository";

export type AccountBalanceRow = {
  id: string;
  name: string;
  institution: string | null;
  maskedIdentifier: string | null;
  kind: AccountKind;
  kindLabelSv: string;
  currency: CurrencyCode;
  isDefault: boolean;
  isActive?: boolean;
  /** Native currency balance. */
  calculatedMinor: number | null;
  /** Same balance in THB (locked rate). Null when unknown/unconvertible. */
  thbMinor: number | null;
  fxRate: number | null;
  fxSource: string | null;
};

export type AccountsSnapshot = {
  accounts: AccountBalanceRow[];
  archivedAccounts?: AccountBalanceRow[];
  /** Σ THB across convertible active accounts. Null when nothing known. */
  totalThbMinor: number | null;
};

export type AccountsSnapshotResult =
  | { ok: true; data: AccountsSnapshot }
  | { ok: false; error: string };

/** One accounts list + one ledger + per-account checkpoints — no N+1 txs. */
function toBalanceRow(
  account: Awaited<ReturnType<typeof listAccounts>>[number],
  checkpoint: Awaited<ReturnType<typeof getLatestCheckpoint>>,
  transactions: Awaited<ReturnType<typeof listTransactions>>,
): AccountBalanceRow {
  const after = filterTransactionsAfterCheckpoint(transactions, checkpoint);
  let calculatedMinor: number | null = null;
  if (checkpoint) {
    try {
      calculatedMinor =
        calculateAccountBalance({
          checkpoint,
          transactionsAfterCheckpoint: after,
        })?.amountMinor ?? null;
    } catch (error) {
      console.error("[numa] account balance calc failed", error);
    }
  }
  const thbMinor =
    calculatedMinor != null && checkpoint
      ? balanceToThbMinor(calculatedMinor, account.currency, checkpoint)
      : null;
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    maskedIdentifier: account.maskedIdentifier,
    kind: account.kind,
    kindLabelSv: ACCOUNT_KIND_LABEL_SV[account.kind],
    currency: account.currency,
    isDefault: account.isDefault,
    isActive: account.isActive,
    calculatedMinor,
    thbMinor,
    fxRate: checkpoint?.fxRate ?? null,
    fxSource: checkpoint?.fxSource ?? null,
  };
}

export const loadAccountsSnapshot = cache(
  async (): Promise<AccountsSnapshotResult> => {
    try {
      const [accounts, archived] = await Promise.all([
        listAccounts(),
        listArchivedAccounts(),
      ]);
      const all = [...accounts, ...archived];
      const [checkpoints, transactions] = await Promise.all([
        Promise.all(all.map((account) => getLatestCheckpoint(account.id))),
        all.length > 0
          ? listTransactions()
          : Promise.resolve([] as Awaited<ReturnType<typeof listTransactions>>),
      ]);

      const txsByAccount = new Map<string, typeof transactions>();
      for (const tx of transactions) {
        const list = txsByAccount.get(tx.accountId);
        if (list) list.push(tx);
        else txsByAccount.set(tx.accountId, [tx]);
      }

      const rows = all.map((account, index) =>
        toBalanceRow(
          account,
          checkpoints[index] ?? null,
          txsByAccount.get(account.id) ?? [],
        ),
      );
      const activeRows = rows.filter((row) => row.isActive);
      const archivedRows = rows.filter((row) => !row.isActive);

      let totalThbMinor: number | null = null;
      for (const row of activeRows) {
        if (row.thbMinor == null) continue;
        totalThbMinor = (totalThbMinor ?? 0) + row.thbMinor;
      }

      return {
        ok: true,
        data: {
          accounts: activeRows,
          archivedAccounts: archivedRows,
          totalThbMinor,
        },
      };
    } catch (error) {
      unstable_rethrow(error);
      console.error("[numa] loadAccountsSnapshot failed", error);
      void reportError("loader.accounts", error);
      return {
        ok: false,
        error: loadErrorMessageSv(error, "Kunde inte hämta saldon"),
      };
    }
  },
);
