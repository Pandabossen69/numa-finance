import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import {
  APP_PLAN_START_MONTH,
  CANONICAL_CURRENCY,
  spendingCategoriesByMonthKey,
  appliesToIncome,
  appliesToSpending,
  calculateAccountBalance,
  checkpointMapForAccounts,
  filterTransactionsAfterCheckpoint,
  monthKeyFromDate,
  projectLedgerToCanonicalThb,
  projectPayCycle,
  sortNewestFirst,
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
  listPlanItems,
  listTransactions,
} from "@/lib/store/repository";

/** Same history window as Hem/Plan/Analys — never pull the entire ledger. */
export const MOVEMENTS_LEDGER_SINCE_ISO = `${APP_PLAN_START_MONTH}-01T00:00:00.000Z`;

/** Hard cap so Analys → Transaktioner cannot sit on an unbounded PostgREST read. */
export const MOVEMENTS_LEDGER_LIMIT = 2_500;

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
  /** Idempotency key for a quick-add. Matches the temp row until the server id lands. */
  clientMutationId?: string | null;
  /** Stable list key so swapping a temp id for the server id does not remount the row. */
  listKey?: string;
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
  /** Current pay cycle, so Rörelser can show Perioden without an Analys drill. */
  payCycleStartAt?: string | null;
  payCycleEndAt?: string | null;
  /** Ledger content token. Optimistic paints append `:local`. */
  financeRevision?: string;
  verifiedAt?: string;
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

  const items: MovementRow[] = sortNewestFirst(confirmed).map((tx) => {
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
        clientMutationId: tx.clientMutationId ?? null,
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
 * Content token shared by the Rörelser page and mutation snapshots.
 * Same ledger ⇒ same revision, so an optimistic `:local` paint can refuse
 * the pre-write echo and accept the post-write one.
 */
export function movementsLedgerRevision(
  transactions: readonly {
    id: string;
    amountMinor: number;
    updatedAt?: string | null;
  }[],
  balanceMinor: number | null,
): { financeRevision: string; verifiedAt: string } {
  const rows = [...transactions].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  let newest = "";
  let body = `${rows.length}:${balanceMinor ?? "null"}`;
  for (const tx of rows) {
    const updated = tx.updatedAt ?? "";
    if (updated > newest) newest = updated;
    body += `|${tx.id}:${tx.amountMinor}:${updated}`;
  }
  const verifiedAt = newest || "1970-01-01T00:00:00.000Z";
  return {
    financeRevision: `${newest || "0"}::mov:${body}`,
    verifiedAt,
  };
}

/**
 * Rörelser: profile + bounded ledger (plan history window), Σ THB saldo like Hem/Konton.
 */
export const loadMovementsSnapshot = cache(
  async (): Promise<MovementsSnapshotResult> => {
    try {
      const [profile, accounts, planItems] = await Promise.all([
        getProfile(),
        listAccounts(),
        listPlanItems(),
      ]);
      const [transactions, checkpoints] = await Promise.all([
        listTransactions(undefined, {
          sinceIso: MOVEMENTS_LEDGER_SINCE_ISO,
          limit: MOVEMENTS_LEDGER_LIMIT,
        }),
        Promise.all(accounts.map((account) => getLatestCheckpoint(account.id))),
      ]);

      const timeZone = profile.timezone || "Asia/Bangkok";
      const data = buildMovementsSnapshot({
        accounts,
        transactions,
        checkpoints,
        timeZone,
      });
      const cycle = projectPayCycle(planItems, new Date(), timeZone);
      return {
        ok: true,
        data: {
          ...data,
          payCycleStartAt: cycle.startAt,
          payCycleEndAt: cycle.endAt,
          ...movementsLedgerRevision(transactions, data.balanceMinor),
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
