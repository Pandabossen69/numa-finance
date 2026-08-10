import { cache } from "react";
import { appliesToIncome, appliesToSpending } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { listTransactions } from "@/lib/store/repository";

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
  balanceMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  safeToSpendTodayMinor: number;
  monthIncomeMinor: number;
  monthExpenseMinor: number;
  monthNetMinor: number;
  allIncomeMinor: number;
  allExpenseMinor: number;
  allNetMinor: number;
  monthCategories: CategoryTotal[];
  items: MovementRow[];
};

export type MovementsSnapshotResult =
  | { ok: true; data: MovementsSnapshot }
  | { ok: false; error: string };

function monthKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

const listCachedTransactions = cache(async () =>
  listTransactions(undefined, { limit: 200 }),
);

export async function loadMovementsSnapshot(): Promise<MovementsSnapshotResult> {
  try {
    const [snap, transactions] = await Promise.all([
      getCachedTodaySnapshot(),
      listCachedTransactions(),
    ]);

    const timezone = snap.profile.timezone || "Asia/Bangkok";
    const thisMonth = monthKey(new Date().toISOString(), timezone);
    const currency = snap.currency;

    let monthIncomeMinor = 0;
    let monthExpenseMinor = 0;
    let allIncomeMinor = 0;
    let allExpenseMinor = 0;
    const categoryMap = new Map<string, CategoryTotal>();

    const confirmed = transactions.filter((t) => t.status === "confirmed");

    for (const tx of confirmed) {
      const inMonth = monthKey(tx.occurredAt, timezone) === thisMonth;
      const isExpense = appliesToSpending(tx);
      const isIncome = appliesToIncome(tx);

      if (isExpense) {
        allExpenseMinor += tx.amountMinor;
        if (inMonth) {
          monthExpenseMinor += tx.amountMinor;
          const name = tx.category?.trim() || "Övrigt";
          const prev = categoryMap.get(name) ?? {
            name,
            amountMinor: 0,
            count: 0,
          };
          prev.amountMinor += tx.amountMinor;
          prev.count += 1;
          categoryMap.set(name, prev);
        }
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
        description: tx.description,
        category: tx.category,
        transactionType: tx.transactionType,
        direction: tx.direction,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        occurredAt: tx.occurredAt,
        source: tx.source,
      }));

    const monthCategories = [...categoryMap.values()].sort(
      (a, b) => b.amountMinor - a.amountMinor,
    );

    return {
      ok: true,
      data: {
        currency,
        hasBankTruth: snap.checkpoint != null,
        balanceMinor: snap.calculatedBalanceMinor ?? 0,
        freeMinor: snap.freeMinor,
        reservedMinor: snap.reservedMinor,
        bufferMinor: snap.bufferMinor,
        safeToSpendTodayMinor: snap.safeToSpendTodayMinor,
        monthIncomeMinor,
        monthExpenseMinor,
        monthNetMinor: monthIncomeMinor - monthExpenseMinor,
        allIncomeMinor,
        allExpenseMinor,
        allNetMinor: allIncomeMinor - allExpenseMinor,
        monthCategories,
        items,
      },
    };
  } catch (error) {
    console.error("[numa] loadMovementsSnapshot failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte hämta utgifter och intäkter",
    };
  }
}
