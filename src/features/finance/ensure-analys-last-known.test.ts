import { afterEach, describe, expect, it } from "vitest";
import { analysViewCanPaint } from "@/features/finance/analys-client-fetch";
import { ensurePaintableAnalysSnapshot } from "@/features/finance/ensure-analys-last-known";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  clearClientSessionCaches,
  lastAnalysSnapshot,
  rememberAnalysSnapshot,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
} from "@/features/home/last-snapshot";

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

const home = {
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
} as HomeSnapshot;

afterEach(() => {
  clearClientSessionCaches();
});

describe("ensurePaintableAnalysSnapshot", () => {
  it("returns null when nothing is cached", () => {
    expect(ensurePaintableAnalysSnapshot()).toBeNull();
    expect(lastAnalysSnapshot()).toBeNull();
  });

  it("keeps a paint-able last-known and does not rebuild from Plan", () => {
    rememberPlanSnapshot(plan);
    rememberHomeSnapshot(home);
    const first = ensurePaintableAnalysSnapshot();
    expect(analysViewCanPaint(first)).toBe(true);
    rememberAnalysSnapshot({
      ...first!,
      todaySpendingMinor: 50_00,
    });
    const next = ensurePaintableAnalysSnapshot();
    expect(next?.todaySpendingMinor).toBe(50_00);
  });

  it("derives from Hem alone when Plan persist is empty", () => {
    rememberHomeSnapshot(home);
    const snap = ensurePaintableAnalysSnapshot();
    expect(analysViewCanPaint(snap)).toBe(true);
    expect(snap?.cycle.remainingFreeMinor).toBe(home.remainingFreeMinor);
    expect(snap?.cycle.daysLeft).toBe(home.spendDaysLeft);
    expect(lastAnalysSnapshot()).toBe(snap);
  });

  it("derives from Plan + Hem when Analys persist is empty", () => {
    rememberHomeSnapshot(home);
    rememberPlanSnapshot(plan);
    const snap = ensurePaintableAnalysSnapshot();
    expect(analysViewCanPaint(snap)).toBe(true);
    expect(snap?.todaySpendingMinor).toBe(200_00);
    expect(snap?.calculatedBalanceMinor).toBe(10_000_00);
    expect(snap?.currentMonthKey).toBe("2026-09");
    expect(lastAnalysSnapshot()).toBe(snap);
  });
});
