import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  CANONICAL_CURRENCY,
  spendingCategoriesByMonthKey,
  appliesToIncome,
  appliesToSpending,
  calculateAccountBalance,
  checkpointMapForAccounts,
  filterTransactionsAfterCheckpoint,
  monthKeyFromDate,
  projectLedgerToCanonicalThb,
  totalSaldoThbMinor,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
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
  /** Canonical THB for list totals / Hem. */
  amountMinor: number;
  currency: CurrencyCode;
  /** Native booking — edit prefills this, never the projected THB. */
  nativeAmountMinor: number;
  nativeCurrency: CurrencyCode;
  accountId?: string | null;
  fxRate?: number | null;
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

export {
  mergeMovementNativeFromServer,
  movementEditPrefill,
} from "@/features/finance/movement-native";

/**
 * All-account Rörelser view: every confirmed row, totals in canonical THB.
 * Transfers and cash withdrawals stay on the list but do not count as spend.
 */
export function buildMovementsSnapshot(input: {
  accounts: Account[];
  transactions: CanonicalTransaction[];
  checkpoints: Array<BalanceCheckpoint | null>;
  timeZone: string;
  now?: Date;
}): MovementsSnapshot {
  const now = input.now ?? new Date();
  const thisMonth = monthKeyFromDate(now, input.timeZone);
  const checkpointByAccountId = checkpointMapForAccounts(
    input.accounts,
    input.checkpoints,
  );

  const txsByAccount = new Map<string, CanonicalTransaction[]>();
  for (const tx of input.transactions) {
    const list = txsByAccount.get(tx.accountId);
    if (list) list.push(tx);
    else txsByAccount.set(tx.accountId, [tx]);
  }

  const balanceMinor = totalSaldoThbMinor(
    input.accounts.map((account, index) => {
      const checkpoint = input.checkpoints[index] ?? null;
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

  const confirmed = input.transactions.filter((tx) => tx.status === "confirmed");
  const canonical = projectLedgerToCanonicalThb(
    confirmed,
    checkpointByAccountId,
  );
  const canonicalById = new Map(canonical.map((tx) => [tx.id, tx]));

  let monthIncomeMinor = 0;
  let monthExpenseMinor = 0;
  let allIncomeMinor = 0;
  let allExpenseMinor = 0;

  for (const tx of canonical) {
    const inMonth =
      monthKeyFromDate(new Date(tx.occurredAt), input.timeZone) === thisMonth;
    if (appliesToSpending(tx)) {
      allExpenseMinor += tx.amountMinor;
      if (inMonth) monthExpenseMinor += tx.amountMinor;
    }
    if (appliesToIncome(tx)) {
      allIncomeMinor += tx.amountMinor;
      if (inMonth) monthIncomeMinor += tx.amountMinor;
    }
  }

  const items: MovementRow[] = [...confirmed]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .map((tx) => {
      const projected = canonicalById.get(tx.id);
      const amountMinor = projected?.amountMinor ?? tx.thbMinor ?? tx.amountMinor;
      const currency = (projected?.currency ??
        (tx.thbMinor != null ? CANONICAL_CURRENCY : tx.currency)) as CurrencyCode;
      return {
        id: tx.id,
        description: humanizeMovementTitle(
          sanitizeMoneyDescription(tx.description),
          tx.direction === "debit" ? -amountMinor : amountMinor,
        ),
        category: tx.category,
        transactionType: tx.transactionType,
        direction: tx.direction,
        amountMinor,
        currency,
        nativeAmountMinor: tx.amountMinor,
        nativeCurrency: tx.currency,
        accountId: tx.accountId,
        fxRate: tx.fxRate ?? checkpointByAccountId.get(tx.accountId)?.fxRate ?? null,
        occurredAt: tx.occurredAt,
        source: tx.source,
      };
    });

  const monthCategories =
    spendingCategoriesByMonthKey({
      transactions: canonical,
      currency: CANONICAL_CURRENCY,
      timeZone: input.timeZone,
    })[thisMonth] ?? [];

  return {
    currency: CANONICAL_CURRENCY,
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
    timeZone: input.timeZone,
    monthKey: thisMonth,
  };
}

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
      const [transactions, checkpoints] = await Promise.all([
        listTransactions(),
        Promise.all(accounts.map((account) => getLatestCheckpoint(account.id))),
      ]);

      return {
        ok: true,
        data: buildMovementsSnapshot({
          accounts,
          transactions,
          checkpoints,
          timeZone: profile.timezone || "Asia/Bangkok",
        }),
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
