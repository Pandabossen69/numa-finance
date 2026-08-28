import { describe, expect, it } from "vitest";
import { clearPlanWarmup, hasPlanSnapshot } from "@/components/plan/plan-cache";
import { clearClientSessionMemory } from "./clear-session-memory";
import {
  lastHomeSnapshot,
  rememberHomeSnapshot,
} from "./last-snapshot";
import type { HomeSnapshot } from "@/features/finance/load-home";

function homeSnap(): HomeSnapshot {
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
  };
}

describe("clearClientSessionMemory", () => {
  it("drops last-known Hem and the Plan warmup latch", () => {
    rememberHomeSnapshot(homeSnap());
    expect(lastHomeSnapshot()).not.toBeNull();
    clearPlanWarmup();
    clearClientSessionMemory();
    expect(lastHomeSnapshot()).toBeNull();
    expect(hasPlanSnapshot()).toBe(false);
  });
});
