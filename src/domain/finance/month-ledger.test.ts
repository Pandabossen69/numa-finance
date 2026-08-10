import { describe, expect, it } from "vitest";
import {
  buildMonthSummary,
  parseMonthKey,
  shiftMonthKey,
} from "./month-ledger";
import type { CanonicalTransaction } from "./types";

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<
      CanonicalTransaction,
      "transactionType" | "direction" | "amountMinor" | "occurredAt"
    >,
): CanonicalTransaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    direction: partial.direction,
    transactionType: partial.transactionType,
    amountMinor: partial.amountMinor,
    currency: "THB",
    occurredAt: partial.occurredAt,
    description: partial.description ?? "Test",
    merchant: null,
    category: partial.category ?? null,
    source: "manual",
    status: partial.status ?? "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    transferGroupId: partial.transferGroupId ?? null,
    syncStatus: "synced",
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
  };
}

describe("month ledger", () => {
  it("parses and shifts month keys", () => {
    expect(parseMonthKey("2026-08")).toBe("2026-08");
    expect(shiftMonthKey("2026-08", -1)).toBe("2026-07");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("summarizes spending and income for a month", () => {
    const summary = buildMonthSummary({
      monthKey: "2026-08",
      currency: "THB",
      timezone: "Asia/Bangkok",
      transactions: [
        tx({
          transactionType: "expense",
          direction: "debit",
          amountMinor: 620_00,
          occurredAt: "2026-08-09T10:00:00+07:00",
          description: "Lunch",
        }),
        tx({
          transactionType: "income",
          direction: "credit",
          amountMinor: 5000_00,
          occurredAt: "2026-08-01T09:00:00+07:00",
          description: "CSN",
        }),
        tx({
          transactionType: "expense",
          direction: "debit",
          amountMinor: 100_00,
          occurredAt: "2026-07-30T10:00:00+07:00",
          description: "Old",
        }),
        tx({
          transactionType: "expense",
          direction: "debit",
          amountMinor: 50_00,
          occurredAt: "2026-08-09T11:00:00+07:00",
          status: "voided",
          description: "Removed",
        }),
      ],
    });

    expect(summary.spending.amountMinor).toBe(620_00);
    expect(summary.income.amountMinor).toBe(5000_00);
    expect(summary.net.amountMinor).toBe(5000_00 - 620_00);
    expect(summary.movementCount).toBe(2);
  });
});
