import { describe, expect, it } from "vitest";
import type { HomeSnapshot } from "@/features/finance/load-home";
import {
  parseLastHomeCookie,
  serializeLastHomeCookie,
} from "./last-home-cookie";

function home(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "u1",
    displayName: "Hugo",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "acc",
    currency: "THB",
    monthKey: "2026-09",
    monthLabelSv: "september",
    hasBankTruth: true,
    calculatedBalanceMinor: 12_000_00,
    verificationLabel: null,
    todaySpendingMinor: 200_00,
    todayPlannedPaidMinor: 0,
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
    remainingFreeMinor: 11_000_00,
    spendDaysLeft: 10,
    dayBudgetMinor: 1_000_00,
    remainingTodayMinor: 800_00,
    daysUntilIncome: 10,
    nextIncomeLabelSv: null,
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 0,
    wealthTotalMinor: 12_000_00,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: 12_000_00,
    financeRevision: "r1",
    verifiedAt: "2026-09-08T08:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

describe("last-home cookie", () => {
  it("round-trips Hem numbers for the first HTML", () => {
    const encoded = serializeLastHomeCookie(home());
    expect(encoded).toBeTruthy();
    const next = parseLastHomeCookie(encoded);
    expect(next?.remainingTodayMinor).toBe(800_00);
    expect(next?.dayBudgetMinor).toBe(1_000_00);
    expect(next?.displayName).toBe("Hugo");
  });

  it("rejects a cookie that cannot paint Hem numbers", () => {
    expect(parseLastHomeCookie("")).toBeNull();
    expect(parseLastHomeCookie("{")).toBeNull();
    expect(parseLastHomeCookie(JSON.stringify({ userId: "u1" }))).toBeNull();
  });
});
