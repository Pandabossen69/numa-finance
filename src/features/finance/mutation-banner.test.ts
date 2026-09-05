import { beforeEach, describe, expect, it } from "vitest";
import {
  applyMovementsAdd,
  applyMovementsEdit,
  applyOptimisticHomeSpend,
  adoptMutationFinance,
  clearClientSessionCaches,
  lastHomeSnapshot,
  rememberHomeSnapshot,
  rememberMovementsSnapshot,
} from "@/features/home/last-snapshot";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import {
  financeTruthMessageSv,
  shouldShowFinanceTruthBanner,
} from "./finance-truth-copy";
import { SAVED_REFRESH_PENDING_SV } from "./mutation-refresh";

function homeSnap(partial: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    userId: "user-hugo",
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
    financeRevision: "test-rev",
    verifiedAt: "2026-08-26T05:00:00.000Z",
    truthStatus: "verified",
    ...partial,
  };
}

const movements: MovementsSnapshot = {
  currency: "THB",
  hasBankTruth: true,
  balanceMinor: 10_000_00,
  monthIncomeMinor: 0,
  monthExpenseMinor: 20_00,
  monthNetMinor: -20_00,
  allIncomeMinor: 0,
  allExpenseMinor: 20_00,
  allNetMinor: -20_00,
  monthCategories: [{ name: "Mat", amountMinor: 20_00, count: 1 }],
  items: [
    {
      id: "tx1",
      description: "Lunch",
      category: "Mat",
      transactionType: "expense",
      direction: "debit",
      amountMinor: 20_00,
      currency: "THB",
      nativeAmountMinor: 20_00,
      nativeCurrency: "THB",
      accountId: "acc",
      fxRate: 1,
      occurredAt: "2026-08-10T12:00:00.000Z",
      source: "manual",
    },
  ],
  timeZone: "Asia/Bangkok",
  monthKey: "2026-08",
};

describe("mutation result vs Hem truth banner", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("does not show Vi kan inte räkna just nu after a successful edit with refresh pending", () => {
    rememberHomeSnapshot(homeSnap());
    rememberMovementsSnapshot(movements);
    applyMovementsEdit("tx1", {
      amountMinor: 35_00,
      nativeAmountMinor: 35_00,
      description: "Middag",
    });

    // The previously observed bug: treating the refresh-pending copy as `error`
    // made Hem render the stale-truth banner after a durable write.
    const previousBuggyCondition =
      SAVED_REFRESH_PENDING_SV ||
      lastHomeSnapshot()?.truthStatus === "stale" ||
      lastHomeSnapshot()?.truthStatus === "unavailable";
    expect(previousBuggyCondition).toBeTruthy();
    expect(
      financeTruthMessageSv({
        truthStatus: lastHomeSnapshot()?.truthStatus === "verified" ? "stale" : lastHomeSnapshot()?.truthStatus,
      }).title,
    ).toBe("Vi kan inte räkna just nu.");

    adoptMutationFinance({});
    expect(lastHomeSnapshot()?.truthStatus).toBe("verified");
    expect(
      shouldShowFinanceTruthBanner({
        truthStatus: lastHomeSnapshot()?.truthStatus,
        error: SAVED_REFRESH_PENDING_SV,
        refreshPending: true,
      }),
    ).toBe(false);
    expect(
      financeTruthMessageSv({ truthStatus: lastHomeSnapshot()?.truthStatus }).title,
    ).toBe("");
  });

  it("does not set beräkningsfel after a successful SEK expense save", () => {
    rememberHomeSnapshot(
      homeSnap({
        cycleSpendingMinor: 38_817_00,
        todaySpendingMinor: 70_00,
        calculatedBalanceMinor: 10_000_00,
        remainingTodayMinor: 730_00,
        remainingFreeMinor: 11_183_00,
      }),
    );
    rememberMovementsSnapshot({
      ...movements,
      monthExpenseMinor: 38_817_00,
      allExpenseMinor: 38_817_00,
    });

    applyOptimisticHomeSpend(3_50);

    const afterOptimistic = lastHomeSnapshot();
    expect(afterOptimistic?.cycleSpendingMinor).toBe(38_820_50);
    expect(afterOptimistic?.todaySpendingMinor).toBe(73_50);
    expect(afterOptimistic?.truthStatus).toBe("verified");
    expect(
      shouldShowFinanceTruthBanner({
        truthStatus: afterOptimistic?.truthStatus,
      }),
    ).toBe(false);
    expect(
      financeTruthMessageSv({ truthStatus: afterOptimistic?.truthStatus }).title,
    ).toBe("");

    adoptMutationFinance({
      home: {
        ...afterOptimistic!,
        financeRevision: "after-sek-save",
        verifiedAt: "2026-09-05T08:20:00.000Z",
        truthStatus: "verified",
      },
    });
    applyMovementsAdd({
      id: "qa79-cloud-save",
      description: "QA79 cloud save",
      category: null,
      transactionType: "expense",
      direction: "debit",
      amountMinor: 3_50,
      currency: "THB",
      nativeAmountMinor: 1_00,
      nativeCurrency: "SEK",
      accountId: "test-sek",
      fxRate: 3.5,
      occurredAt: "2026-09-05T08:20:00.000Z",
      source: "manual",
    });

    const afterSave = lastHomeSnapshot();
    expect(afterSave?.cycleSpendingMinor).toBe(38_820_50);
    expect(afterSave?.truthStatus).toBe("verified");
    expect(
      shouldShowFinanceTruthBanner({ truthStatus: afterSave?.truthStatus }),
    ).toBe(false);
  });
});
