import { describe, expect, it } from "vitest";
import { projectCashCoverage } from "@/domain/finance";
import { createEmptyStore } from "./types";
import { emptyTodaySnapshot } from "./empty-snapshot";

describe("new user empty snapshot", () => {
  it("starts with no plan, accounts, or transactions and zero coverage", () => {
    const store = createEmptyStore();
    expect(store.accounts).toEqual([]);
    expect(store.planItems).toEqual([]);
    expect(store.transactions).toEqual([]);
    expect(store.profile.timezone).toBe("Asia/Bangkok");
    expect(store.profile.primaryCurrency).toBe("THB");

    const snap = emptyTodaySnapshot(store.profile);
    expect(snap.accounts).toEqual([]);
    expect(snap.planItems).toEqual([]);
    expect(snap.recentTransactions).toEqual([]);
    expect(snap.ledgerTransactions).toEqual([]);
    expect(snap.primaryAccount).toBeNull();
    expect(snap.checkpoint).toBeNull();
    expect(snap.calculatedBalanceMinor).toBeNull();
    expect(snap.todaySpendingMinor).toBe(0);
    expect(snap.monthSpendingMinor).toBe(0);
    expect(snap.cycleSpendingMinor).toBe(0);
    expect(snap.safeToSpendTodayMinor).toBe(0);
    expect(snap.freeMinor).toBe(0);
    expect(snap.reservedMinor).toBe(0);

    const coverage = projectCashCoverage({
      planItems: snap.planItems,
      transactions: snap.ledgerTransactions,
      monthKey: "2026-08",
      timeZone: snap.profile.timezone,
      saldoMinor: snap.calculatedBalanceMinor,
    });
    expect(coverage.incomingMinor).toBe(0);
    expect(coverage.unpaidMinor).toBe(0);
    expect(coverage.overMinor).toBe(0);
    expect(coverage.saldoMinor).toBeNull();
  });
});
