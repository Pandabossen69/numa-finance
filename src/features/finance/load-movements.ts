import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  spendingCategoriesByMonthKey,
  appliesToIncome,
  appliesToSpending,
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
  monthKeyFromDate,
  totalSaldoThbMinor,
} from "@/domain/finance";
import {
  humanizeMovementTitle,
  sanitizeMoneyDescription,
  type CurrencyCode,
} from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import {
  getLatestCheckpoint,
  getProfile,
  listAccounts,
  listTransactions,
} from "@/lib/store/repository";

export type MovementRow = {
  id: string;
  description: string;
  category: string | null;
  transactionType: string;
  direction: "debit" | "credit";
  amountMinor: number;
  currency: CurrencyCode;
  occurredAt: string;
  source: string;
};

export type CategoryTotal = {
  name: string;
  amountMinor: number;
  count: number;
};

export type MovementsSnapshot = {
  currency: CurrencyCode;
  hasBankTruth: boolean;
  /** null when saldo is unknown — never show as ฿0. Always Σ THB. */
  balanceMinor: number | null;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  monthNetMinor: number;
  allIncomeMinor: number;
  allExpenseMinor: number;
  allNetMinor: number;
  monthCategories: CategoryTotal[];
  items: MovementRow[];
  timeZone: string;
  monthKey: string;
};

export type MovementsSnapshotResult =
  | { ok: true; data: MovementsSnapshot }
  | { ok: false; error: string };

/**
 * Rörelser: profile + full ledger for the list, Σ THB saldo like Hem/Konton.
 */
export const loadMovementsSnapshot = cache(
  async (): Promise<MovementsSnapshotResult> => {
    try {
      const [profile, accounts] = await Promise.all([
        getProfile(),
        listAccounts(),
      ]);
      const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
      const [transactions, checkpoints] = await Promise.all([
        listTransactions(),
        Promise.all(accounts.map((account) => getLatestCheckpoint(account.id))),
      ]);

      const timezone = profile.timezone || "Asia/Bangkok";
      const thisMonth = monthKeyFromDate(new Date(), timezone);
      const ledgerCurrency = (primary?.currency ??
        profile.primaryCurrency) as CurrencyCode;

      const txsByAccount = new Map<string, typeof transactions>();
      for (const tx of transactions) {
        const list = txsByAccount.get(tx.accountId);
        if (list) list.push(tx);
        else txsByAccount.set(tx.accountId, [tx]);
      }

      const balanceMinor = totalSaldoThbMinor(
        accounts.map((account, index) => {
          const checkpoint = checkpoints[index] ?? null;
          let nativeMinor: number | null = null;
          if (checkpoint) {
            const after = filterTransactionsAfterCheckpoint(
              txsByAccount.get(account.id) ?? [],
              checkpoint,
            );
            try {
              nativeMinor =
                calculateAccountBalance({
                  checkpoint,
                  transactionsAfterCheckpoint: after,
                })?.amountMinor ?? null;
            } catch (error) {
              console.error("[numa] movements balance calc failed", error);
            }
          }
          return { account, nativeMinor, checkpoint };
        }),
      );

      let monthIncomeMinor = 0;
      let monthExpenseMinor = 0;
      let allIncomeMinor = 0;
      let allExpenseMinor = 0;

      const confirmed = transactions.filter(
        (t) =>
          t.status === "confirmed" &&
          t.currency === ledgerCurrency &&
          (primary == null || t.accountId === primary.id),
      );

      for (const tx of confirmed) {
        const inMonth =
          monthKeyFromDate(new Date(tx.occurredAt), timezone) === thisMonth;
        const isExpense = appliesToSpending(tx);
        const isIncome = appliesToIncome(tx);

        if (isExpense) {
          allExpenseMinor += tx.amountMinor;
          if (inMonth) monthExpenseMinor += tx.amountMinor;
        }
        if (isIncome) {
          allIncomeMinor += tx.amountMinor;
          if (inMonth) monthIncomeMinor += tx.amountMinor;
        }
      }

      const items: MovementRow[] = [...confirmed]
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .map((tx) => ({
          id: tx.id,
          description: humanizeMovementTitle(
            sanitizeMoneyDescription(tx.description),
            tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor,
          ),
          category: tx.category,
          transactionType: tx.transactionType,
          direction: tx.direction,
          amountMinor: tx.amountMinor,
          currency: tx.currency,
          occurredAt: tx.occurredAt,
          source: tx.source,
        }));

      // Same split Analys shows, from one shared function.
      const monthCategories =
        spendingCategoriesByMonthKey({
          transactions: confirmed,
          currency: ledgerCurrency,
          timeZone: timezone,
        })[thisMonth] ?? [];

      return {
        ok: true,
        data: {
          currency: "THB",
          hasBankTruth: balanceMinor != null,
          balanceMinor,
          monthIncomeMinor,
          monthExpenseMinor,
          monthNetMinor: monthIncomeMinor - monthExpenseMinor,
          allIncomeMinor,
          allExpenseMinor,
          allNetMinor: allIncomeMinor - allExpenseMinor,
          monthCategories,
          items,
          timeZone: timezone,
          monthKey: thisMonth,
        },
      };
    } catch (error) {
      unstable_rethrow(error);
      console.error("[numa] loadMovementsSnapshot failed", error);
      return {
        ok: false,
        error: loadErrorMessageSv(
          error,
          "Kunde inte hämta utgifter och intäkter",
        ),
      };
    }
  },
);
