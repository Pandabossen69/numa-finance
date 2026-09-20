import { describe, expect, it } from "vitest";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import {
  analysSnapshotFromHome,
  analysSnapshotFromPlan,
  analysSnapshotFromToday,
  isThinAnalysSnapshot,
} from "@/features/finance/analys-from-known";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { TodaySnapshot } from "@/lib/store/types-snapshot";

const now = new Date("2026-09-19T05:00:00.000Z");

const plan: PlanSnapshot = {
  items: [
    {
      id: "inc-1",
      userId: "user-hugo",
      name: "Lön",
      kind: "expected",
      amountMinor: 20_000_00,
      currency: "THB",
      cadence: "monthly",
      nextDueAt: "2026-09-01T00:00:00.000Z",
      isActive: true,
      settledAt: "2026-09-01T00:00:00.000Z",
      settledMinor: 20_000_00,
      remainingDueAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ],
  currency: "THB",
  timeZone: "Asia/Bangkok",
  bankBalanceMinor: 10_000_00,
  spendingByMonthKey: { "2026-09": 1_000_00 },
  ledgerTransactions: [],
  financeRevision: "rev-1",
  verifiedAt: "2026-09-19T05:00:00.000Z",
  truthStatus: "verified",
};

const home: HomeSnapshot = {
  userId: "user-hugo",
  displayName: "Hugo",
  timeZone: "Asia/Bangkok",
  primaryAccountId: "acc",
  currency: "THB",
  monthKey: "2026-09",
  monthLabelSv: "september",
  hasBankTruth: true,
  calculatedBalanceMinor: 10_000_00,
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
  planExpenseMinor: 0,
  planSavingsMinor: 0,
  freeToSpendMinor: 20_000_00,
  remainingFreeMinor: 19_600_00,
  spendDaysLeft: 12,
  dayBudgetMinor: 1_000_00,
  remainingTodayMinor: 800_00,
  livingPoolMinor: 10_000_00,
  reservedUntilIncomeMinor: 0,
  daysUntilIncome: 12,
  nextIncomeLabelSv: null,
  extraSaldoMinor: 0,
  extraSaldoDrawnMinor: 0,
  extraSaldoHint: null,
  extraCarriedInMinor: 0,
  savingsTotalMinor: 0,
  wealthTotalMinor: 10_000_00,
  monthResultMinor: 0,
  incomingMinor: 0,
  unpaidMinor: 0,
  overMinor: 10_000_00,
  financeRevision: "rev-1",
  verifiedAt: "2026-09-19T05:00:00.000Z",
  truthStatus: "verified",
};

describe("analysSnapshotFromHome", () => {
  it("copies leftover and daysLeft from Hem and can paint chrome", () => {
    const snap = analysSnapshotFromHome(home, now);
    expect(analysViewCanPaint(snap)).toBe(true);
    expect(isThinAnalysSnapshot(snap)).toBe(true);
    expect(snap.cycle.remainingFreeMinor).toBe(home.remainingFreeMinor);
    expect(snap.cycle.daysLeft).toBe(home.spendDaysLeft);
    expect(snap.cycle.dayBudgetMinor).toBe(home.dayBudgetMinor);
    expect(snap.cycle.remainingTodayMinor).toBe(home.remainingTodayMinor);
    expect(snap.todaySpendingMinor).toBe(home.todaySpendingMinor);
    expect(snap.monthSpendingMinor).toBe(home.monthSpendingMinor);
    expect(snap.truthStatus).toBe("stale");
  });
});

describe("analysSnapshotFromPlan", () => {
  it("builds a paint-able Analys last-known from Plan + Hem", () => {
    const snap = analysSnapshotFromPlan(plan, home, now);
    expect(analysViewCanPaint(snap)).toBe(true);
    expect(snap.todaySpendingMinor).toBe(200_00);
    expect(snap.cycleSpendingMinor).toBe(400_00);
    expect(snap.monthSpendingMinor).toBe(1_000_00);
    expect(snap.calculatedBalanceMinor).toBe(10_000_00);
    expect(snap.currentMonthKey).toBe("2026-09");
    expect(snap.month).toBeTruthy();
  });

  it("does not invent leftover when Hem spend figures are present", () => {
    const withHome = analysSnapshotFromPlan(plan, home, now);
    const withoutHome = analysSnapshotFromPlan(plan, null, now);
    expect(withHome.todaySpendingMinor).toBe(home.todaySpendingMinor);
    expect(withoutHome.todaySpendingMinor).toBe(0);
    expect(withHome.cycleSpendingMinor).toBe(home.cycleSpendingMinor);
    expect(withoutHome.cycleSpendingMinor).toBe(0);
  });
});

describe("analysSnapshotFromToday", () => {
  it("matches the Plan-derived paint fields for the same TodaySnapshot", () => {
    const today = {
      profile: {
        id: "user-hugo",
        displayName: "Hugo",
        timezone: "Asia/Bangkok",
      },
      accounts: [],
      primaryAccount: null,
      checkpoint: { id: "cp" },
      accountBalances: [],
      calculatedBalanceMinor: 10_000_00,
      balanceKind: "calculated",
      verificationLabel: null,
      todaySpendingMinor: 200_00,
      todayPlannedPaidMinor: 0,
      monthSpendingMinor: 1_000_00,
      cycleSpendingMinor: 400_00,
      monthSpendingByKey: { "2026-09": 1_000_00 },
      fundingConfirmed: true,
      safeToSpendTodayMinor: 800_00,
      safeToSpendWeekMinor: 0,
      freeMinor: 0,
      reservedMinor: 0,
      bufferMinor: 0,
      flexibleMinor: 0,
      daysUntilIncome: 12,
      recentTransactions: [],
      ledgerTransactions: [],
      planItems: plan.items,
      currency: "THB",
      progress: null,
      financeRevision: "rev-1",
      verifiedAt: "2026-09-19T05:00:00.000Z",
    } as unknown as TodaySnapshot;

    const fromToday = analysSnapshotFromToday(today, now);
    const fromPlan = analysSnapshotFromPlan(plan, home, now);
    expect(fromToday.currentMonthKey).toBe(fromPlan.currentMonthKey);
    expect(fromToday.todaySpendingMinor).toBe(fromPlan.todaySpendingMinor);
    expect(fromToday.cycleSpendingMinor).toBe(fromPlan.cycleSpendingMinor);
    expect(fromToday.calculatedBalanceMinor).toBe(
      fromPlan.calculatedBalanceMinor,
    );
    expect(analysViewCanPaint(fromToday)).toBe(true);
  });
});
