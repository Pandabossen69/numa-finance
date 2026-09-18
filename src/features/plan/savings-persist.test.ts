import { beforeEach, describe, expect, it } from "vitest";
import { findMonthSavings, MONTHLY_SAVE_NAME, type PlanItem } from "@/domain/finance";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  adoptMutationFinance,
  clearClientSessionCaches,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
} from "@/features/home/last-snapshot";
import { applyMonthSavings } from "@/features/plan/optimistic";

const TZ = "Asia/Bangkok";
const MONTH = "2026-09";

function planItem(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name ?? MONTHLY_SAVE_NAME,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "savings",
    nextDueAt: partial.nextDueAt ?? "2026-09-15T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    createdAt: partial.createdAt ?? "2026-09-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-09-01T00:00:00.000Z",
  };
}

function planSnap(items: PlanItem[], partial: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    items,
    currency: "THB",
    timeZone: TZ,
    bankBalanceMinor: 18_176_00,
    spendingByMonthKey: {},
    ledgerTransactions: [],
    financeRevision: "rev-3000",
    verifiedAt: "2026-09-18T08:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

function homeSnap(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "u1",
    displayName: "Test",
    timeZone: TZ,
    primaryAccountId: "a1",
    currency: "THB",
    monthKey: MONTH,
    monthLabelSv: "september 2026",
    hasBankTruth: true,
    calculatedBalanceMinor: 18_176_00,
    verificationLabel: null,
    todaySpendingMinor: 0,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 0,
    cycleSpendingMinor: 0,
    safeToSpendTodayMinor: 1_211_73,
    cycleStartLabelSv: "3 sep.",
    cycleEndLabelSv: "3 okt.",
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: true,
    planIncomeMinor: 40_000_00,
    planExpenseMinor: 18_176_00,
    planSavingsMinor: 3_000_00,
    freeToSpendMinor: 18_176_00,
    remainingFreeMinor: 18_176_00,
    spendDaysLeft: 15,
    dayBudgetMinor: 1_211_73,
    remainingTodayMinor: 1_211_73,
    daysUntilIncome: 15,
    nextIncomeLabelSv: "3 okt.",
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 3_000_00,
    wealthTotalMinor: 18_176_00,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 0,
    overMinor: 18_176_00,
    financeRevision: "rev-3000",
    verifiedAt: "2026-09-18T08:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

describe("month savings persist across remount", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("keeps 7500 after adopt + remount and drops the leftover 3000 row", () => {
    const leftover = planItem({
      id: "save-3000",
      kind: "goal",
      amountMinor: 3_000_00,
      updatedAt: "2026-09-10T00:00:00.000Z",
    });
    const current = planItem({
      id: "save-5000",
      kind: "goal",
      amountMinor: 5_000_00,
      updatedAt: "2026-09-18T08:00:00.000Z",
    });
    rememberHomeSnapshot(homeSnap());
    rememberPlanSnapshot(planSnap([leftover, current]));

    const applied = applyMonthSavings(
      [leftover, current],
      MONTH,
      7_500_00,
      "THB",
      TZ,
    );
    expect(applied.previous?.id).toBe(current.id);
    expect(applied.items.find((row) => row.id === leftover.id)).toBeUndefined();
    expect(findMonthSavings(applied.items, MONTH, TZ)?.amountMinor).toBe(7_500_00);

    rememberPlanSnapshot(
      planSnap(applied.items, {
        financeRevision: "rev-3000:local",
        verifiedAt: "2026-09-18T08:01:00.000Z",
        truthStatus: "stale",
      }),
    );

    const saved = {
      ...current,
      amountMinor: 7_500_00,
      updatedAt: "2026-09-18T08:01:30.000Z",
    };
    adoptMutationFinance({
      home: homeSnap({
        planSavingsMinor: 7_500_00,
        savingsTotalMinor: 7_500_00,
        remainingTodayMinor: 911_73,
        dayBudgetMinor: 911_73,
        safeToSpendTodayMinor: 911_73,
        financeRevision: "rev-7500",
        verifiedAt: "2026-09-18T08:01:40.000Z",
      }),
      plan: planSnap([saved], {
        financeRevision: "rev-7500",
        verifiedAt: "2026-09-18T08:01:40.000Z",
      }),
    });

    // Soft-nav remount reads last-known only (PlanRouteClient skips refetch).
    const remounted = lastPlanSnapshot();
    expect(findMonthSavings(remounted?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      7_500_00,
    );
    expect(remounted?.items.some((row) => row.amountMinor === 3_000_00)).toBe(false);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(911_73);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(
      lastSessionHomeSnapshot()?.remainingTodayMinor,
    );

    rememberPlanSnapshot(
      planSnap([leftover, current], {
        financeRevision: "rev-3000",
        verifiedAt: "2026-09-18T08:00:00.000Z",
      }),
    );
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      7_500_00,
    );
  });

  it("force-adopts a savings plan snapshot even when verifiedAt is older", () => {
    rememberPlanSnapshot(
      planSnap(
        [
          planItem({
            id: "save-3000",
            kind: "goal",
            amountMinor: 3_000_00,
          }),
        ],
        {
          financeRevision: "live-local",
          verifiedAt: "2026-09-18T08:02:00.000Z",
        },
      ),
    );
    adoptMutationFinance({
      plan: planSnap(
        [
          planItem({
            id: "save-7500",
            kind: "goal",
            amountMinor: 7_500_00,
            updatedAt: "2026-09-18T08:01:00.000Z",
          }),
        ],
        {
          financeRevision: "rev-7500",
          verifiedAt: "2026-09-18T08:01:00.000Z",
        },
      ),
    });
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      7_500_00,
    );
  });
});
