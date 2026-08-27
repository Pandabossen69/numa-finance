import { cache } from "react";
import {
  extraSaldoHintSv,
  cumulativePlanSavingsMinor,
  labelMonthSv,
  monthKeyFromDate,
  planWealthTotalMinor,
  projectCashCoverage,
  projectExtraSaldo,
  projectLivingBudget,
  projectPayCycle,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  displayName: string;
  timeZone: string;
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
  /** bridge = tills nästa intäkt (saldo), cycle = efter lön (plan), empty = saknar intäkter */
  livingMode: "bridge" | "cycle" | "empty";
  needsAvailableInput: boolean;
  usesBankBalance: boolean;
  planIncomeMinor: number;
  planExpenseMinor: number;
  planSavingsMinor: number;
  /** Plan free before actual cycle spending (cycle mode reference). */
  freeToSpendMinor: number;
  /** What you have left to live on right now. */
  remainingFreeMinor: number;
  spendDaysLeft: number;
  /** Morning sticky dagsbudget — does not fall when you spend today. */
  dayBudgetMinor: number;
  /** Signed leftover of today's sticky dagsbudget (negative = overspent). */
  remainingTodayMinor: number;
  daysUntilIncome: number;
  nextIncomeLabelSv: string | null;
  extraSaldoMinor: number;
  extraSaldoDrawnMinor: number;
  extraSaldoHint: string | null;
  extraCarriedInMinor: number;
  savingsTotalMinor: number;
  wealthTotalMinor: number;
  monthResultMinor: number;
  /** Remaining planned income not yet in the ledger. */
  incomingMinor: number;
  /** Remaining planned expenses not yet in the ledger (not savings). */
  unpaidMinor: number;
  /** Saldo + kommer in − kvar att betala. */
  overMinor: number;
};

export type HomeSnapshotResult =
  { ok: true; data: HomeSnapshot } | { ok: false; error: string };

export const getCachedTodaySnapshot = cache(getTodaySnapshot);

export async function loadHomeSnapshot(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const timeZone = snap.profile.timezone || "Asia/Bangkok";
    const now = new Date();
    const monthKey = monthKeyFromDate(now, timeZone);
    const cycle = projectPayCycle(snap.planItems ?? [], now, timeZone);
    const cycleSpendingMinor = snap.cycleSpendingMinor ?? 0;
    const living = projectLivingBudget({
      cycle,
      now,
      timeZone,
      bankBalanceMinor: snap.calculatedBalanceMinor,
      cycleSpendingMinor,
      todaySpendingMinor: snap.todaySpendingMinor,
      fundingConfirmed: snap.fundingConfirmed,
    });

    const extra = projectExtraSaldo({
      planItems: snap.planItems ?? [],
      spendingByMonthKey: snap.monthSpendingByKey ?? {},
      monthKey,
      currentMonthKey: monthKey,
      timeZone,
    });
    const coverage = projectCashCoverage({
      planItems: snap.planItems ?? [],
      transactions: snap.ledgerTransactions ?? [],
      monthKey,
      timeZone,
      saldoMinor: snap.calculatedBalanceMinor,
    });
    const savingsTotalMinor = cumulativePlanSavingsMinor(
      snap.planItems ?? [],
      monthKey,
      timeZone,
    );

    return {
      ok: true,
      data: {
        displayName: snap.profile.displayName,
        timeZone,
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
        // Prefer living-budget hero number over legacy STS dual engine.
        safeToSpendTodayMinor: living.remainingTodayMinor,
        cycleStartLabelSv: cycle.startLabelSv,
        cycleEndLabelSv: living.cycleEndLabelSv,
        cycleEndInferred: living.cycleEndInferred,
        cycleIsActive: cycle.isActive && snap.fundingConfirmed,
        livingMode: living.mode,
        needsAvailableInput: living.needsAvailableInput,
        usesBankBalance: living.usesBankBalance,
        planIncomeMinor: cycle.incomeMinor,
        planExpenseMinor: cycle.expenseMinor,
        planSavingsMinor: cycle.savingsMinor,
        freeToSpendMinor: cycle.freeToSpendMinor,
        remainingFreeMinor: living.remainingFreeMinor,
        spendDaysLeft: living.daysUntilHorizon,
        dayBudgetMinor: living.dayBudgetMinor,
        remainingTodayMinor: living.remainingTodayMinor,
        daysUntilIncome: living.daysUntilHorizon,
        nextIncomeLabelSv: living.nextIncomeLabelSv,
        extraSaldoMinor: extra.extraSaldoMinor,
        extraSaldoDrawnMinor: extra.drawnMinor,
        extraSaldoHint: extraSaldoHintSv(extra, monthKey) ?? null,
        extraCarriedInMinor: extra.carriedInMinor,
        savingsTotalMinor,
        wealthTotalMinor: planWealthTotalMinor(coverage.overMinor, savingsTotalMinor),
        monthResultMinor: extra.monthResultMinor,
        incomingMinor: coverage.incomingMinor,
        unpaidMinor: coverage.unpaidMinor,
        overMinor: coverage.overMinor,
      },
    };
  } catch (error) {
    console.error("[numa] loadHomeSnapshot failed", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte hämta din ekonomi"),
    };
  }
}
