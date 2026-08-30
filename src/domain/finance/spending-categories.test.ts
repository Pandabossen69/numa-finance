import { describe, expect, it } from "vitest";
import type { CanonicalTransaction } from "./types";
import {
  spendingByMonthKey,
  spendingCategoriesByMonthKey,
  UNCATEGORISED_SPEND_NAME,
} from "./month-carryover";

const TZ = "Asia/Bangkok";

function tx(partial: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    accountId: "a1",
    direction: partial.direction ?? "debit",
    transactionType: partial.transactionType ?? "expense",
    amountMinor: partial.amountMinor ?? 100_00,
    currency: "THB",
    occurredAt: partial.occurredAt ?? "2026-08-10T09:00:00.000Z",
    description: partial.description ?? "köp",
    merchant: null,
    category: partial.category ?? null,
    source: "manual",
    status: partial.status ?? "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
    ...partial,
  } as CanonicalTransaction;
}

describe("spendingCategoriesByMonthKey", () => {
  const transactions = [
    tx({ amountMinor: 300_00, category: "Mat", occurredAt: "2026-08-02T09:00:00.000Z" }),
    tx({ amountMinor: 150_00, category: "Mat", occurredAt: "2026-08-11T09:00:00.000Z" }),
    tx({ amountMinor: 900_00, category: "Boende", occurredAt: "2026-08-03T09:00:00.000Z" }),
    tx({ amountMinor: 50_00, category: "  ", occurredAt: "2026-08-04T09:00:00.000Z" }),
    tx({ amountMinor: 700_00, category: "Mat", occurredAt: "2026-07-09T09:00:00.000Z" }),
    // Must be ignored: income, and an unconfirmed expense.
    tx({
      amountMinor: 5_000_00,
      transactionType: "income",
      direction: "credit",
      occurredAt: "2026-08-05T09:00:00.000Z",
    }),
    tx({
      amountMinor: 400_00,
      category: "Shopping",
      status: "needs_review",
      occurredAt: "2026-08-06T09:00:00.000Z",
    }),
  ];

  const categories = spendingCategoriesByMonthKey({
    transactions,
    currency: "THB",
    timeZone: TZ,
  });
  const totals = spendingByMonthKey({ transactions, currency: "THB", timeZone: TZ });

  it("splits a month by category, biggest first", () => {
    expect(categories["2026-08"]?.map((c) => [c.name, c.amountMinor, c.count])).toEqual([
      ["Boende", 900_00, 1],
      ["Mat", 450_00, 2],
      [UNCATEGORISED_SPEND_NAME, 50_00, 1],
    ]);
  });

  it("keeps each month separate", () => {
    expect(categories["2026-07"]?.map((c) => c.name)).toEqual(["Mat"]);
    expect(categories["2026-07"]?.[0]?.amountMinor).toBe(700_00);
  });

  it("always adds up to the month's spending", () => {
    for (const [monthKey, lines] of Object.entries(categories)) {
      const sum = lines.reduce((total, line) => total + line.amountMinor, 0);
      expect(sum, `categories must equal spending for ${monthKey}`).toBe(
        totals[monthKey],
      );
    }
    // And nothing that spends is missing a bucket.
    expect(Object.keys(categories).sort()).toEqual(Object.keys(totals).sort());
  });

  it("leaves out income and rows that are not confirmed", () => {
    const names = categories["2026-08"]?.map((c) => c.name) ?? [];
    expect(names).not.toContain("Shopping");
    expect(totals["2026-08"]).toBe(900_00 + 450_00 + 50_00);
  });
});
