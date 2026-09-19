import { beforeEach, describe, expect, it } from "vitest";
import { findMonthSavings, MONTHLY_SAVE_NAME, type PlanItem } from "@/domain/finance";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  adoptMutationFinance,
  clearClientSessionCaches,
  isLeftoverSparLivingRevert,
  lastHomeSnapshot,
  lastPlanSnapshot,
  lastSessionHomeSnapshot,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
  syncHomeLivingFromPlan,
} from "@/features/home/last-snapshot";
import { applyHomeLeftoverSparDelta } from "@/features/finance/snapshot-from-today";
import { rememberLivePlan } from "@/components/plan/plan-cache";
import {
  prefetchAdjacentPlanMonths,
  resetPlanMonthCacheForTests,
} from "@/features/plan/plan-month-cache";
import { applyMonthSavings, ensureMonthSavings } from "@/features/plan/optimistic";

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
    livingPoolMinor: 18_176_00,
    reservedUntilIncomeMinor: 0,
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

const leftoverHome = (partial: Partial<HomeSnapshot> = {}): HomeSnapshot =>
  homeSnap({
    monthKey: MONTH,
    calculatedBalanceMinor: 3_421_95,
    remainingTodayMinor: 275_12,
    dayBudgetMinor: 275_12,
    safeToSpendTodayMinor: 275_12,
    livingPoolMinor: 1_650_75,
    remainingFreeMinor: 1_650_75,
    spendDaysLeft: 6,
    planSavingsMinor: 15_000_00,
    savingsTotalMinor: 15_000_00,
    planMonthSavingsMinor: 15_000_00,
    reservedUntilIncomeMinor: 0,
    reservedSavingsUntilIncomeMinor: 15_000_00,
    overMinor: 59_981_00,
    financeRevision: "rev-15k",
    verifiedAt: "2026-09-19T08:00:00.000Z",
    ...partial,
  });

function leftoverPlanItems(saveMinor: number): PlanItem[] {
  return [
    planItem({
      id: "lön-aug",
      name: "Lön aug",
      kind: "expected",
      amountMinor: 40_000_00,
      cadence: "income",
      nextDueAt: "2026-08-25T12:00:00.000Z",
    }),
    planItem({
      id: "lön-sep",
      name: "Lön sep",
      kind: "expected",
      amountMinor: 40_000_00,
      cadence: "income",
      nextDueAt: "2026-09-25T12:00:00.000Z",
    }),
    planItem({
      id: "sep-save",
      kind: "goal",
      amountMinor: saveMinor,
      cadence: "savings",
      nextDueAt: "2026-09-20T12:00:00.000Z",
      updatedAt: "2026-09-19T08:00:00.000Z",
    }),
  ];
}

describe("Spec O leftover save persist + Hem adopt", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("applyHomeLeftoverSparDelta drops 275,12 on 15k→20k even when reservedUntilIncome is 0", () => {
    const next = applyHomeLeftoverSparDelta(leftoverHome(), 5_000_00, 15_000_00);
    expect(next.dayBudgetMinor).toBe(0);
    expect(next.remainingTodayMinor).toBe(0);
    expect(next.planMonthSavingsMinor).toBe(20_000_00);
  });

  it("skips 0→N so Spec L leftover 275,12 stays at first 15k", () => {
    const next = applyHomeLeftoverSparDelta(leftoverHome(), 15_000_00, 0);
    expect(next.dayBudgetMinor).toBe(275_12);
    expect(next.remainingTodayMinor).toBe(275_12);
  });

  it("after save, Hem living matches Plan and remount keeps 20k", () => {
    const at15k = leftoverHome();
    rememberHomeSnapshot(at15k);
    rememberPlanSnapshot(planSnap(leftoverPlanItems(15_000_00)));

    const applied = applyMonthSavings(
      leftoverPlanItems(15_000_00),
      MONTH,
      20_000_00,
      "THB",
      TZ,
    );
    const patched = ensureMonthSavings(
      leftoverPlanItems(15_000_00),
      MONTH,
      20_000_00,
      "THB",
      TZ,
      { ...applied.items.find((row) => row.id === "sep-save")!, amountMinor: 20_000_00 },
    );
    expect(findMonthSavings(patched, MONTH, TZ)?.amountMinor).toBe(20_000_00);

    const savedHome = applyHomeLeftoverSparDelta(at15k, 5_000_00, 15_000_00);
    adoptMutationFinance({
      home: {
        ...savedHome,
        overMinor: 54_981_00,
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      },
      plan: planSnap(patched, {
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      }),
    });

    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(0);
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(0);
    expect(lastHomeSnapshot()?.overMinor).toBe(54_981_00);
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      20_000_00,
    );

    rememberHomeSnapshot(
      leftoverHome({
        financeRevision: "rev-cookie",
        verifiedAt: "2026-09-19T08:03:00.000Z",
      }),
    );
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(0);
    expect(isLeftoverSparLivingRevert(lastHomeSnapshot()!, leftoverHome())).toBe(true);

    rememberPlanSnapshot(
      planSnap(leftoverPlanItems(15_000_00), {
        financeRevision: "rev-15k",
        verifiedAt: "2026-09-19T08:00:00.000Z",
      }),
    );
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      20_000_00,
    );
  });

  it("hydrate at 15k keeps leftover 275,12 — no 275→0 flash", () => {
    rememberHomeSnapshot(leftoverHome());
    syncHomeLivingFromPlan(
      planSnap(leftoverPlanItems(15_000_00), {
        bankBalanceMinor: 3_421_95,
      }),
    );
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
  });

  it("sync from Plan 15k→20k drops Hem leftover and a stale 15k plan cannot restore 275,12", () => {
    rememberHomeSnapshot(leftoverHome());
    rememberPlanSnapshot(planSnap(leftoverPlanItems(15_000_00)));
    syncHomeLivingFromPlan(
      planSnap(leftoverPlanItems(20_000_00), {
        financeRevision: "rev-20k:local",
        verifiedAt: "2026-09-19T08:02:00.000Z",
        bankBalanceMinor: 3_421_95,
      }),
    );
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(0);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(0);

    syncHomeLivingFromPlan(
      planSnap(leftoverPlanItems(15_000_00), {
        financeRevision: "rev-15k",
        verifiedAt: "2026-09-19T08:00:00.000Z",
        bankBalanceMinor: 3_421_95,
      }),
    );
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(0);
    expect(lastHomeSnapshot()?.remainingTodayMinor).toBe(0);
    expect(lastHomeSnapshot()?.planMonthSavingsMinor).toBe(20_000_00);
  });

  it("does not re-apply leftover delta on restore 20k→15k (QA 1 108,45)", () => {
    const serverAt15k = leftoverHome({
      financeRevision: "rev-15k-restore",
      verifiedAt: "2026-09-19T08:04:00.000Z",
    });
    const next = applyHomeLeftoverSparDelta(serverAt15k, -5_000_00, 20_000_00);
    expect(next.dayBudgetMinor).toBe(275_12);
    expect(next.remainingTodayMinor).toBe(275_12);
    expect(next.planMonthSavingsMinor).toBe(15_000_00);
    expect(next.dayBudgetMinor).not.toBe(1_108_45);
  });

  it("after restore 20k→15k, soft remount Hem living matches Plan leftover 275,12", () => {
    const at15k = leftoverHome();
    rememberHomeSnapshot(at15k);
    rememberPlanSnapshot(planSnap(leftoverPlanItems(15_000_00)));

    const savedHome = applyHomeLeftoverSparDelta(at15k, 5_000_00, 15_000_00);
    adoptMutationFinance({
      home: {
        ...savedHome,
        overMinor: 54_981_00,
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      },
      plan: planSnap(leftoverPlanItems(20_000_00), {
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      }),
    });
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(0);

    const serverRestore = leftoverHome({
      financeRevision: "rev-15k-restore",
      verifiedAt: "2026-09-19T08:04:00.000Z",
    });
    const restoredHome = applyHomeLeftoverSparDelta(
      serverRestore,
      -5_000_00,
      20_000_00,
    );
    adoptMutationFinance({
      home: restoredHome,
      plan: planSnap(leftoverPlanItems(15_000_00), {
        financeRevision: "rev-15k-restore",
        verifiedAt: "2026-09-19T08:04:00.000Z",
        bankBalanceMinor: 3_421_95,
      }),
    });

    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.planMonthSavingsMinor).toBe(15_000_00);
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)?.amountMinor).toBe(
      15_000_00,
    );

    // Soft-nav remount reads last-known + Plan sync (no full reload).
    syncHomeLivingFromPlan(
      planSnap(leftoverPlanItems(15_000_00), {
        financeRevision: "rev-15k-restore",
        verifiedAt: "2026-09-19T08:04:00.000Z",
        bankBalanceMinor: 3_421_95,
      }),
    );
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.planMonthSavingsMinor).toBe(15_000_00);
  });

  it("after restore 15k, soft Hem↔Plan↔Hem keep-shell keeps leftover 275,12", () => {
    resetPlanMonthCacheForTests();
    const at15k = leftoverHome();
    rememberHomeSnapshot(at15k);
    rememberPlanSnapshot(planSnap(leftoverPlanItems(15_000_00)));

    const savedHome = applyHomeLeftoverSparDelta(at15k, 5_000_00, 15_000_00);
    adoptMutationFinance({
      home: {
        ...savedHome,
        overMinor: 54_981_00,
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      },
      plan: planSnap(leftoverPlanItems(20_000_00), {
        financeRevision: "rev-20k",
        verifiedAt: "2026-09-19T08:02:00.000Z",
      }),
    });

    const serverRestore = leftoverHome({
      financeRevision: "rev-15k-restore",
      verifiedAt: "2026-09-19T08:04:00.000Z",
    });
    const restoredHome = applyHomeLeftoverSparDelta(
      serverRestore,
      -5_000_00,
      20_000_00,
    );
    const restoredPlan = planSnap(leftoverPlanItems(15_000_00), {
      financeRevision: "rev-15k-restore",
      verifiedAt: "2026-09-19T08:04:00.000Z",
      bankBalanceMinor: 3_421_95,
    });
    adoptMutationFinance({
      home: restoredHome,
      plan: restoredPlan,
    });
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);

    // Plan keep-shell: publish :local + prefetch ±1 + PlanScreen sync (no reload).
    prefetchAdjacentPlanMonths({
      items: restoredPlan.items,
      ledgerTransactions: restoredPlan.ledgerTransactions,
      monthKey: MONTH,
      timeZone: TZ,
      saldoMinor: restoredPlan.bankBalanceMinor,
    });
    rememberLivePlan({
      ...restoredPlan,
      financeRevision: "rev-15k-restore:local",
      verifiedAt: "2026-09-19T20:50:00.000Z",
      truthStatus: "stale",
    });
    syncHomeLivingFromPlan(lastPlanSnapshot() ?? restoredPlan);
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);

    // Hem tab reads last-known — same as soft-nav Hem → Plan → Hem.
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(275_12);
    expect(lastSessionHomeSnapshot()?.planMonthSavingsMinor).toBe(15_000_00);
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(275_12);
    expect(lastHomeSnapshot()?.dayBudgetMinor).not.toBe(330_15);
  });

  it("after nollställ, soft remount adopts the post-clear living — not leftover 275,12", () => {
    rememberHomeSnapshot(leftoverHome());
    adoptMutationFinance({
      home: leftoverHome(),
      plan: planSnap(leftoverPlanItems(15_000_00)),
    });
    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(275_12);

    const clearedItems = leftoverPlanItems(15_000_00).filter((row) => row.id !== "sep-save");
    const clearedHome = leftoverHome({
      planSavingsMinor: 0,
      savingsTotalMinor: 0,
      planMonthSavingsMinor: 0,
      reservedSavingsUntilIncomeMinor: 0,
      dayBudgetMinor: 570_32,
      remainingTodayMinor: 570_32,
      livingPoolMinor: 3_421_95,
      remainingFreeMinor: 3_421_95,
      overMinor: 74_981_00,
      financeRevision: "rev-0",
      verifiedAt: "2026-09-19T08:05:00.000Z",
    });
    const adopted = applyHomeLeftoverSparDelta(clearedHome, -15_000_00, 15_000_00);
    expect(adopted.dayBudgetMinor).toBe(570_32);
    expect(adopted.planMonthSavingsMinor).toBe(0);

    adoptMutationFinance({
      home: adopted,
      plan: planSnap(clearedItems, {
        financeRevision: "rev-0",
        verifiedAt: "2026-09-19T08:05:00.000Z",
        bankBalanceMinor: 3_421_95,
      }),
    });

    expect(lastSessionHomeSnapshot()?.dayBudgetMinor).toBe(570_32);
    expect(lastSessionHomeSnapshot()?.remainingTodayMinor).toBe(570_32);
    expect(lastSessionHomeSnapshot()?.planMonthSavingsMinor).toBe(0);
    expect(findMonthSavings(lastPlanSnapshot()?.items ?? [], MONTH, TZ)).toBeUndefined();
    expect(lastHomeSnapshot()?.dayBudgetMinor).toBe(
      lastSessionHomeSnapshot()?.dayBudgetMinor,
    );
  });
});
