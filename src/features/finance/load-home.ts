import { cache } from "react";
import {
  NEXT_INCOME_NAME,
  isPlanIncome,
  isPlanSavings,
  labelMonthSv,
  monthKeyFromDate,
  projectPayCycle,
  projectPlanForMonth,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  primaryAccountId: string | null;
  currency: CurrencyCode;
  /** Live calendar month (for labels / month spending). */
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
  /** Pay-cycle figures (same as Plan active cycle). */
  cycleStartLabelSv: string | null;
  cycleEndLabelSv: string | null;
  cycleEndInferred: boolean;
  cycleIsActive: boolean;
  planIncomeMinor: number;
  planExpenseMinor: number;
  /** Income − expenses (before savings) in cycle. */
  planRemainingMinor: number;
  planSavingsMinor: number;
  freeToSpendMinor: number;
  spendDaysLeft: number;
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
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
    const monthProj = projectPlanForMonth(
      snap.planItems ?? [],
      monthKey,
      timeZone,
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
        reservedMinor: cycle.expenseMinor || monthProj.totalPlannedMinor,
        bufferMinor: cycle.bufferMinor || monthProj.bufferMinor,
        cycleStartLabelSv: cycle.startLabelSv,
        cycleEndLabelSv: cycle.endLabelSv,
        cycleEndInferred: cycle.endInferred,
        cycleIsActive: cycle.isActive,
        planIncomeMinor: cycle.incomeMinor,
        planExpenseMinor: cycle.expenseMinor,
        planRemainingMinor: cycle.freeToSpendMinor + cycle.savingsMinor,
        planSavingsMinor: cycle.savingsMinor,
        freeToSpendMinor: cycle.freeToSpendMinor,
        spendDaysLeft: cycle.daysLeft,
        perDayBudgetMinor: cycle.perDayMinor,
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
