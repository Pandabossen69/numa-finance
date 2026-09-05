import { describe, expect, it, beforeEach } from "vitest";
import type { PlanItem } from "@/domain/finance";
import {
  applyOptimisticPlanSettle,
  clearClientSessionCaches,
  confirmOptimisticFinance,
  isHomeDirty,
  lastHomeSnapshot,
  rememberHomeSnapshot,
  rememberPlanSnapshot,
  syncHomeLivingFromPlan,
} from "@/features/home/last-snapshot";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { PlanSnapshot } from "@/features/finance/load-plan";

function homeSnap(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "u1",
    displayName: "Test",
    timeZone: "Asia/Bangkok",
    primaryAccountId: "a1",
    currency: "THB",
    monthKey: "2026-08",
    monthLabelSv: "augusti 2026",
    hasBankTruth: true,
    calculatedBalanceMinor: 50_000_00,
    verificationLabel: null,
    todaySpendingMinor: 0,
    todayPlannedPaidMinor: 0,
    monthSpendingMinor: 1_200_00,
    cycleSpendingMinor: 1_200_00,
    safeToSpendTodayMinor: 30_800_00,
    cycleStartLabelSv: "25 aug.",
    cycleEndLabelSv: "25 sep.",
    cycleEndInferred: false,
    cycleIsActive: true,
    livingMode: "cycle",
    needsAvailableInput: false,
    usesBankBalance: false,
    planIncomeMinor: 60_000_00,
    planExpenseMinor: 25_000_00,
    planSavingsMinor: 3_000_00,
    freeToSpendMinor: 32_000_00,
    remainingFreeMinor: 30_800_00,
    spendDaysLeft: 30,
    dayBudgetMinor: 1_026_66,
    remainingTodayMinor: 30_800_00,
    daysUntilIncome: 30,
    nextIncomeLabelSv: "25 sep.",
    extraSaldoMinor: 0,
    extraSaldoDrawnMinor: 0,
    extraSaldoHint: null,
    extraCarriedInMinor: 0,
    savingsTotalMinor: 3_000_00,
    wealthTotalMinor: 50_000_00,
    monthResultMinor: 0,
    incomingMinor: 0,
    unpaidMinor: 25_000_00,
    overMinor: 25_000_00,
    financeRevision: "rev-1",
    verifiedAt: "2026-08-26T05:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

function planItem(partial: Partial<PlanItem> & Pick<PlanItem, "name" | "kind" | "amountMinor">): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-08-05T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
  };
}

function planSnap(items: PlanItem[], partial: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    items,
    currency: "THB",
    timeZone: "Asia/Bangkok",
    bankBalanceMinor: 50_000_00,
    spendingByMonthKey: {},
    ledgerTransactions: [],
    financeRevision: "rev-1",
    verifiedAt: "2026-08-26T05:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

describe("finance consistency contract", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("confirmOptimisticFinance clears dirty so Plan adopts server payload", () => {
    rememberHomeSnapshot(homeSnap(), { dirty: true });
    expect(isHomeDirty()).toBe(true);
    confirmOptimisticFinance();
    expect(isHomeDirty()).toBe(false);
  });

  it("syncHomeLivingFromPlan realigns Hem after rent settle even while dirty", () => {
    const items = [
      planItem({
        id: "inc",
        name: "Lön",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
        settledMinor: 60_000_00,
        settledAt: "2026-08-25T12:00:00.000Z",
      }),
      planItem({
        id: "inc-next",
        name: "Lön sep",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      planItem({
        id: "rent",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 20_000_00,
        nextDueAt: "2026-08-28T12:00:00.000Z",
        settledMinor: 20_000_00,
        settledAt: "2026-08-26T10:00:00.000Z",
      }),
      planItem({
        id: "extra",
        name: "Extra",
        kind: "expected",
        amountMinor: 5_000_00,
        nextDueAt: "2026-08-30T12:00:00.000Z",
      }),
      planItem({
        id: "save",
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 3_000_00,
        nextDueAt: "2026-08-28T12:00:00.000Z",
      }),
    ];
    rememberHomeSnapshot(homeSnap(), { dirty: true });
    rememberPlanSnapshot(planSnap(items));
    applyOptimisticPlanSettle({
      saldoDeltaMinor: -20_000_00,
      incomingDeltaMinor: 0,
      unpaidDeltaMinor: -20_000_00,
      cycleSpendingDeltaMinor: 20_000_00,
    });
    syncHomeLivingFromPlan(planSnap(items));
    const home = lastHomeSnapshot();
    expect(home?.unpaidMinor).toBe(5_000_00);
    expect(home?.remainingFreeMinor).toBe(30_800_00);
    expect(home?.planExpenseMinor).toBe(5_000_00);
  });

  it("applyOptimisticPlanSettle does not shrink flexible when expense settle books", () => {
    const items = [
      planItem({
        id: "inc",
        name: "Lön",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-08-25T12:00:00.000Z",
        settledMinor: 60_000_00,
        settledAt: "2026-08-25T12:00:00.000Z",
      }),
      planItem({
        id: "inc-next",
        name: "Lön sep",
        kind: "expected",
        amountMinor: 60_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      planItem({
        id: "rent",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 20_000_00,
        nextDueAt: "2026-08-28T12:00:00.000Z",
        settledMinor: 20_000_00,
        settledAt: "2026-08-26T10:00:00.000Z",
      }),
      planItem({
        id: "extra",
        name: "Extra",
        kind: "expected",
        amountMinor: 5_000_00,
        nextDueAt: "2026-08-30T12:00:00.000Z",
      }),
      planItem({
        id: "save",
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 3_000_00,
        nextDueAt: "2026-08-28T12:00:00.000Z",
      }),
    ];
    rememberHomeSnapshot(homeSnap());
    rememberPlanSnapshot(planSnap(items));
    const before = lastHomeSnapshot()?.remainingFreeMinor;
    applyOptimisticPlanSettle({
      saldoDeltaMinor: -20_000_00,
      incomingDeltaMinor: 0,
      unpaidDeltaMinor: -20_000_00,
      cycleSpendingDeltaMinor: 20_000_00,
    });
    expect(lastHomeSnapshot()?.remainingFreeMinor).toBe(before);
  });

  it("QuickAddForms waits for server before success on transfers", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../../components/add/QuickAddForms.tsx", import.meta.url),
      "utf8",
    );
    const transferBlock = src.slice(src.indexOf("function TransferForm"));
    expect(transferBlock).toMatch(/await createTransferAction/);
    expect(transferBlock.indexOf("onSuccess?.()")).toBeGreaterThan(
      transferBlock.indexOf("await createTransferAction"),
    );
    expect(transferBlock).toContain("olika valutor stöds inte ännu");
    expect(transferBlock).toContain("compatibleDestinations");
  });
});
