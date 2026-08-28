import { cache } from "react";
import {
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import {
  getLatestCheckpoint,
  listAccounts,
  listTransactions,
} from "@/lib/store/repository";

export type AccountBalanceRow = {
  id: string;
  name: string;
  institution: string | null;
  maskedIdentifier: string | null;
  currency: CurrencyCode;
  isDefault: boolean;
  calculatedMinor: number | null;
};

export type AccountsSnapshot = {
  accounts: AccountBalanceRow[];
};

export type AccountsSnapshotResult =
  | { ok: true; data: AccountsSnapshot }
  | { ok: false; error: string };

/** One accounts list + one ledger + per-account checkpoints — no N+1 txs. */
export const loadAccountsSnapshot = cache(
  async (): Promise<AccountsSnapshotResult> => {
    try {
      const accounts = await listAccounts();
      const [checkpoints, transactions] = await Promise.all([
        Promise.all(accounts.map((account) => getLatestCheckpoint(account.id))),
        accounts.length > 0
          ? listTransactions()
          : Promise.resolve([] as Awaited<ReturnType<typeof listTransactions>>),
      ]);

      const txsByAccount = new Map<string, typeof transactions>();
      for (const tx of transactions) {
        const list = txsByAccount.get(tx.accountId);
        if (list) list.push(tx);
        else txsByAccount.set(tx.accountId, [tx]);
      }

      return {
        ok: true,
        data: {
          accounts: accounts.map((account, index) => {
            const checkpoint = checkpoints[index] ?? null;
            const txs = txsByAccount.get(account.id) ?? [];
            const after = filterTransactionsAfterCheckpoint(txs, checkpoint);
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
            return {
              id: account.id,
              name: account.name,
              institution: account.institution,
              maskedIdentifier: account.maskedIdentifier,
              currency: account.currency,
              isDefault: account.isDefault,
              calculatedMinor,
            };
          }),
        },
      };
    } catch (error) {
      console.error("[numa] loadAccountsSnapshot failed", error);
      return {
        ok: false,
        error: loadErrorMessageSv(error, "Kunde inte hämta saldon"),
      };
    }
  },
);
