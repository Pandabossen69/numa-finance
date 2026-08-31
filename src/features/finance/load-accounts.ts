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
  kind: AccountKind;
  kindLabelSv: string;
  currency: CurrencyCode;
  isDefault: boolean;
  /** Native currency balance. */
  calculatedMinor: number | null;
  /** Same balance in THB (locked rate). Null when unknown/unconvertible. */
  thbMinor: number | null;
  fxRate: number | null;
  fxSource: string | null;
};

export type AccountsSnapshot = {
  accounts: AccountBalanceRow[];
  /** Σ THB across convertible accounts. Null when nothing known. */
  totalThbMinor: number | null;
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

      const rows: AccountBalanceRow[] = accounts.map((account, index) => {
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
        const thbMinor =
          calculatedMinor != null && checkpoint
            ? balanceToThbMinor(calculatedMinor, account.currency, checkpoint)
            : null;
        // Non-THB without rate → balanceToThb returns 0; treat as unknown.
        const convertible =
          calculatedMinor == null || checkpoint == null
            ? null
            : account.currency === "THB" ||
                (typeof checkpoint.fxRate === "number" && checkpoint.fxRate > 0) ||
                (checkpoint.thbMinor != null &&
                  checkpoint.balanceMinor === calculatedMinor)
              ? thbMinor
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
          calculatedMinor,
          thbMinor: convertible,
          fxRate: checkpoint?.fxRate ?? null,
          fxSource: checkpoint?.fxSource ?? null,
        };
      });

      let totalThbMinor: number | null = null;
      for (const row of rows) {
        if (row.thbMinor == null) continue;
        totalThbMinor = (totalThbMinor ?? 0) + row.thbMinor;
      }

      return {
        ok: true,
        data: {
          accounts: rows,
          totalThbMinor,
        },
      };
    } catch (error) {
      unstable_rethrow(error);
      console.error("[numa] loadAccountsSnapshot failed", error);
      return {
        ok: false,
        error: loadErrorMessageSv(error, "Kunde inte hämta saldon"),
      };
    }
  },
);
