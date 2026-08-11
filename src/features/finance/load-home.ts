import { cache } from "react";
import {
  labelMonthSv,
  monthKeyFromDate,
  perDayBudgetMinor,
  projectPayCycle,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  primaryAccountId: string | null;
  currency: CurrencyCode;
  monthKey: string;
  monthLabelSv: string;
  hasBankTruth: boolean;
  calculatedBalanceMinor: number | null;
  verificationLabel: string | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  cycleSpendingMinor: number;
  safeToSpendTodayMinor: number;
  cycleStartLabelSv: string | null;
  cycleEndLabelSv: string | null;
  cycleEndInferred: boolean;
  cycleIsActive: boolean;
  planIncomeMinor: number;
  planExpenseMinor: number;
  planSavingsMinor: number;
  /** Plan free before actual cycle spending. */
  freeToSpendMinor: number;
  /** free − cycle spending. */
  remainingFreeMinor: number;
  spendDaysLeft: number;
  /** remainingFree ÷ days left. */
  perDayBudgetMinor: number;
  daysUntilIncome: number;
};

export type HomeSnapshotResult =
  | { ok: true; data: HomeSnapshot }
  | { ok: false; error: string };

export const getCachedTodaySnapshot = cache(getTodaySnapshot);

export async function loadHomeSnapshot(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const monthKey = monthKeyFromDate(now, timeZone);
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
    const cycleSpendingMinor = snap.cycleSpendingMinor ?? 0;
    const remainingFreeMinor = cycle.freeToSpendMinor - cycleSpendingMinor;
    const dayBudget = perDayBudgetMinor(remainingFreeMinor, cycle.daysLeft);

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
        todaySpendingMinor: snap.todaySpendingMinor,
        monthSpendingMinor: snap.monthSpendingMinor,
        cycleSpendingMinor,
        safeToSpendTodayMinor: snap.safeToSpendTodayMinor,
        cycleStartLabelSv: cycle.startLabelSv,
        cycleEndLabelSv: cycle.endLabelSv,
        cycleEndInferred: cycle.endInferred,
        cycleIsActive: cycle.isActive,
        planIncomeMinor: cycle.incomeMinor,
        planExpenseMinor: cycle.expenseMinor,
        planSavingsMinor: cycle.savingsMinor,
        freeToSpendMinor: cycle.freeToSpendMinor,
        remainingFreeMinor,
        spendDaysLeft: cycle.daysLeft,
        perDayBudgetMinor: dayBudget,
        daysUntilIncome: snap.daysUntilIncome,
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
