import { describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  applyOptimisticHomeSpend,
  lastAnalysScope,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastPlanView,
  rememberAnalysScope,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
  rememberPlanView,
  revertOptimisticHomeSpend,
  subscribeHomeSnapshot,
  syncHomeCoverageFromPlan,
} from "./last-snapshot";

function homeSnap(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-08",
    monthLabelSv: "augusti",
    hasBankTruth: true,
    calculatedBalanceMinor: 10_000_00,
    verificationLabel: null,
    todaySpendingMinor: 200_00,
    monthSpendingMinor: 1_000_00,
    cycleSpendingMinor: 400_00,
    safeToSpendTodayMinor: 800_00,
    cycleStartLabelSv: null,
    cycleEndLabelSv: null,
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 20_000_00,
    planExpenseMinor: 8_000_00,
    planSavingsMinor: 0,
    freeToSpendMinor: 12_000_00,
    remainingFreeMinor: 11_600_00,
    spendDaysLeft: 10,
    dayBudgetMinor: 1_000_00,
    remainingTodayMinor: 800_00,
    daysUntilIncome: 10,
    nextIncomeLabelSv: null,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 2_000_00,
    wealthTotalMinor: 14_000_00,
    monthResultMinor: 0,
    incomingMinor: 5_000_00,
    unpaidMinor: 3_000_00,
    overMinor: 12_000_00,
    ...partial,
  };
}

describe("last view memory", () => {
  it("keeps Plan month and Analys scope across remounts", () => {
    rememberPlanView({ monthKey: "2027-03", viewYear: 2027 });
    rememberAnalysScope("month");
    expect(lastPlanView()).toEqual({ monthKey: "2027-03", viewYear: 2027 });
    expect(lastAnalysScope()).toBe("month");
  });

  it("notifies Hem when a spend lands before the server round-trip", () => {
    rememberHomeSnapshot(homeSnap());
    let ticks = 0;
    const stop = subscribeHomeSnapshot(() => {
      ticks += 1;
    });
    applyOptimisticHomeSpend(150_00);
    const next = lastHomeSnapshot();
    expect(next?.todaySpendingMinor).toBe(350_00);
    expect(next?.remainingTodayMinor).toBe(650_00);
    expect(next?.calculatedBalanceMinor).toBe(9_850_00);
    expect(next?.overMinor).toBe(9_850_00 + 5_000_00 - 3_000_00);
    expect(ticks).toBeGreaterThan(0);
    revertOptimisticHomeSpend(150_00);
    expect(lastHomeSnapshot()?.todaySpendingMinor).toBe(200_00);
    expect(lastHomeSnapshot()?.overMinor).toBe(12_000_00);
    stop();
  });

  it("keeps Över as saldo + kommer in − kvar att betala when Plan settles", () => {
    rememberHomeSnapshot(
      homeSnap({
        calculatedBalanceMinor: 8_000_00,
        incomingMinor: 2_000_00,
        unpaidMinor: 4_000_00,
        overMinor: 6_000_00,
      }),
    );
    syncHomeCoverageFromPlan({
      items: [
        {
          id: "bill-1",
          userId: "u1",
          name: "Hyra",
          kind: "mandatory",
          amountMinor: 1_000_00,
          currency: "THB",
          cadence: "monthly",
          nextDueAt: "2026-08-05T12:00:00.000Z",
          isActive: true,
          settledAt: "2026-08-02T12:00:00.000Z",
          settledMinor: 1_000_00,
          remainingDueAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-02T12:00:00.000Z",
        },
      ],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 8_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [],
    });
    const next = lastHomeSnapshot();
    expect(next?.unpaidMinor).toBe(0);
    expect(next?.overMinor).toBe(8_000_00 + (next?.incomingMinor ?? 0) - 0);
  });

  it("keeps last-known Plan rows so the editor can paint without waiting", () => {
    rememberPlanSnapshot({
      items: [],
      currency: "THB",
      timeZone: "Asia/Bangkok",
      bankBalanceMinor: 10_000_00,
      spendingByMonthKey: {},
      ledgerTransactions: [],
    });
    expect(lastPlanSnapshot()?.bankBalanceMinor).toBe(10_000_00);
    expect(lastPlanSnapshot()?.currency).toBe("THB");
  });
});
