import { cache } from "react";
import {
  NEXT_INCOME_NAME,
  isPlanIncome,
  isPlanSavings,
  labelMonthSv,
  monthKeyFromDate,
  perDayBudgetMinor,
  projectPlanForMonth,
  spendDaysForMonth,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  primaryAccountId: string | null;
  currency: CurrencyCode;
  /** Live calendar month Home mirrors (always "now"). */
  monthKey: string;
  monthLabelSv: string;
  /** True once first bank-SMS balance has been confirmed. */
  hasBankTruth: boolean;
  calculatedBalanceMinor: number | null;
  verificationLabel: string | null;
  checkpointVerifiedAt: string | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  /** Same figures as Plan for the live month. */
  planIncomeMinor: number;
  planExpenseMinor: number;
  /** Income − expenses (before savings). */
  planRemainingMinor: number;
  /** Month savings target from Plan. */
  planSavingsMinor: number;
  /** Income − expenses − savings. */
  freeToSpendMinor: number;
  /** Remaining calendar days this month (incl. today). */
  spendDaysLeft: number;
  /** freeToSpend ÷ days left. */
  perDayBudgetMinor: number;
  daysUntilIncome: number;
  goals: Array<{
    id: string;
    name: string;
    amountMinor: number;
    currency: CurrencyCode;
  }>;
  recent: Array<{
    id: string;
    description: string;
    category: string | null;
    transactionType: string;
    direction: "debit" | "credit";
    amountMinor: number;
    currency: CurrencyCode;
  }>;
};

export type HomeSnapshotResult =
  | { ok: true; data: HomeSnapshot }
  | { ok: false; error: string };

/** Per-request memo — parallel RSC trees share one snapshot fetch. */
export const getCachedTodaySnapshot = cache(getTodaySnapshot);

export async function loadHomeSnapshot(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const monthKey = monthKeyFromDate(now, timeZone);
    const projection = projectPlanForMonth(
      snap.planItems ?? [],
      monthKey,
      timeZone,
    );
    const spendDaysLeft = spendDaysForMonth(monthKey, now, timeZone);
    const dayBudget = perDayBudgetMinor(
      projection.freeToSpendMinor,
      spendDaysLeft,
    );

    const goals = (snap.planItems ?? [])
      .filter(
        (p) =>
          p.isActive &&
          p.kind === "goal" &&
          p.name !== NEXT_INCOME_NAME &&
          !isPlanIncome(p) &&
          !isPlanSavings(p),
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        amountMinor: g.amountMinor,
        currency: g.currency,
      }));

    const recent = (snap.recentTransactions ?? []).slice(0, 6).map((tx) => ({
      id: tx.id,
      description: tx.description,
      category: tx.category,
      transactionType: tx.transactionType,
      direction: tx.direction,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
    }));

    return {
      ok: true,
      data: {
        primaryAccountId: snap.primaryAccount?.id ?? null,
        currency: snap.currency,
        monthKey,
        monthLabelSv: labelMonthSv(monthKey),
        hasBankTruth: snap.checkpoint != null,
        calculatedBalanceMinor: snap.calculatedBalanceMinor,
        verificationLabel: snap.verificationLabel,
        checkpointVerifiedAt: snap.checkpoint?.verifiedAt ?? null,
        todaySpendingMinor: snap.todaySpendingMinor,
        monthSpendingMinor: snap.monthSpendingMinor,
        safeToSpendTodayMinor: snap.safeToSpendTodayMinor,
        safeToSpendWeekMinor: snap.safeToSpendWeekMinor,
        freeMinor: snap.freeMinor,
        reservedMinor: projection.totalPlannedMinor,
        bufferMinor: projection.bufferMinor,
        planIncomeMinor: projection.incomeMinor,
        planExpenseMinor: projection.totalPlannedMinor,
        planRemainingMinor: projection.freeToSpendMinor + projection.savingsMinor,
        planSavingsMinor: projection.savingsMinor,
        freeToSpendMinor: projection.freeToSpendMinor,
        spendDaysLeft,
        perDayBudgetMinor: dayBudget,
        daysUntilIncome: snap.daysUntilIncome,
        goals,
        recent,
      },
    };
  } catch (error) {
    console.error("[numa] loadHomeSnapshot failed", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte hämta din ekonomi",
    };
  }
}
