import { describe, expect, it } from "vitest";
import {
  appliesToDiscretionarySpending,
  appliesToPlannedPaidSpending,
  classifySpend,
  computeClassifiedSpendingWindows,
} from "./spend-class";
import type { CanonicalTransaction } from "./types";

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "amountMinor" | "occurredAt">,
): CanonicalTransaction {
  return {
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: null,
    category: null,
    status: partial.status ?? "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    syncStatus: "saved",
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    transferGroupId: null,
    planItemId: partial.planItemId ?? null,
    ledgerOrigin: partial.ledgerOrigin,
    linkedPlanItemId: partial.linkedPlanItemId ?? null,
    direction: partial.direction ?? "debit",
    transactionType: partial.transactionType ?? "expense",
    source: partial.source ?? "manual",
    ...partial,
  };
}

const now = new Date("2026-08-26T08:00:00.000Z");
const tz = "Asia/Bangkok";

describe("spend classification", () => {
  it("treats a synthetic settle as planned_paid, not discretionary", () => {
    const settle = tx({
      id: "settle",
      amountMinor: 20_000_00,
      occurredAt: "2026-08-26T07:00:00.000Z",
      ledgerOrigin: "plan_settle",
      planItemId: "rent",
    });
    expect(classifySpend(settle)).toBe("planned_paid");
    expect(appliesToDiscretionarySpending(settle)).toBe(false);
    expect(appliesToPlannedPaidSpending(settle)).toBe(true);
  });

  it("treats a user-linked import as planned_paid", () => {
    const linked = tx({
      id: "sms-rent",
      amountMinor: 20_000_00,
      occurredAt: "2026-08-26T07:00:00.000Z",
      source: "sms",
      linkedPlanItemId: "rent",
      ledgerOrigin: "external",
    });
    expect(classifySpend(linked)).toBe("planned_paid");
  });

  it("keeps lunch as discretionary", () => {
    const lunch = tx({
      id: "lunch",
      amountMinor: 1_200_00,
      occurredAt: "2026-08-26T06:00:00.000Z",
    });
    expect(classifySpend(lunch)).toBe("discretionary");
  });

  it("never counts transfers or cash withdrawals as spending", () => {
    const transfer = tx({
      id: "xfer",
      amountMinor: 5_000_00,
      occurredAt: "2026-08-26T06:00:00.000Z",
      transactionType: "transfer",
    });
    const cashOut = tx({
      id: "cash",
      amountMinor: 2_000_00,
      occurredAt: "2026-08-26T06:00:00.000Z",
      transactionType: "cash_withdrawal",
    });
    expect(classifySpend(transfer)).toBe("none");
    expect(classifySpend(cashOut)).toBe("none");
  });

  it("splits today so settle does not consume the day envelope", () => {
    const lunch = tx({
      id: "lunch",
      amountMinor: 1_200_00,
      occurredAt: "2026-08-26T06:00:00.000Z",
    });
    const settle = tx({
      id: "settle",
      amountMinor: 20_000_00,
      occurredAt: "2026-08-26T07:00:00.000Z",
      ledgerOrigin: "plan_settle",
      planItemId: "rent",
    });
    const windows = computeClassifiedSpendingWindows({
      transactions: [lunch, settle],
      currency: "THB",
      now,
      timeZone: tz,
      cycleStartAt: "2026-08-25T00:00:00.000Z",
      cycleEndAt: "2026-09-25T00:00:00.000Z",
    });
    expect(windows.today.discretionary.amountMinor).toBe(1_200_00);
    expect(windows.today.plannedPaid.amountMinor).toBe(20_000_00);
    expect(windows.today.total.amountMinor).toBe(21_200_00);
    expect(windows.cycle.total.amountMinor).toBe(21_200_00);
    expect(windows.cycle.discretionary.amountMinor).toBe(1_200_00);
  });

  it("counts an 88 THB cash expense as discretionary, never as a plan settle", () => {
    const cash = tx({
      id: "cash-88",
      accountId: "cash",
      amountMinor: 88_00,
      occurredAt: "2026-08-26T09:00:00.000Z",
    });
    expect(appliesToDiscretionarySpending(cash)).toBe(true);
    expect(appliesToPlannedPaidSpending(cash)).toBe(false);
    const windows = computeClassifiedSpendingWindows({
      transactions: [cash],
      currency: "THB",
      now,
      timeZone: tz,
    });
    expect(windows.today.discretionary.amountMinor).toBe(88_00);
    expect(windows.today.plannedPaid.amountMinor).toBe(0);
  });
});
