import { describe, expect, it } from "vitest";
import type { CanonicalTransaction } from "./types";
import {
  OVRIGT_TITLE_LIMIT,
  ovrigtTitleBreakdown,
  spendingByMonthKey,
  spendingCategoriesByMonthKey,
  spendingCategoriesInWindow,
  sumSpendingCategories,
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

  it("breaks equal amounts with Swedish name order", () => {
    const tied = spendingCategoriesByMonthKey({
      transactions: [
        tx({ amountMinor: 200_00, category: "Övrigt", occurredAt: "2026-08-02T09:00:00.000Z" }),
        tx({ amountMinor: 200_00, category: "Åka", occurredAt: "2026-08-03T09:00:00.000Z" }),
        tx({ amountMinor: 200_00, category: "Mat", occurredAt: "2026-08-04T09:00:00.000Z" }),
      ],
      currency: "THB",
      timeZone: TZ,
    });
    expect(tied["2026-08"]?.map((c) => c.name)).toEqual(["Mat", "Åka", "Övrigt"]);
  });

  it("leaves out income and rows that are not confirmed", () => {
    const names = categories["2026-08"]?.map((c) => c.name) ?? [];
    expect(names).not.toContain("Shopping");
    expect(totals["2026-08"]).toBe(900_00 + 450_00 + 50_00);
  });
});

describe("spendingCategoriesInWindow", () => {
  it("adds up to Spenderat i perioden and sorts biggest first", () => {
    const lines = spendingCategoriesInWindow({
      transactions: [
        tx({ amountMinor: 300_00, category: "Mat", occurredAt: "2026-08-02T09:00:00.000Z" }),
        tx({ amountMinor: 150_00, category: "Mat", occurredAt: "2026-08-11T09:00:00.000Z" }),
        tx({ amountMinor: 900_00, category: "Boende", occurredAt: "2026-08-03T09:00:00.000Z" }),
        // On the end instant — half-open window, same as cycle Spenderat.
        tx({ amountMinor: 80_00, category: "Mat", occurredAt: "2026-09-01T00:00:00.000Z" }),
        tx({ amountMinor: 700_00, category: "Mat", occurredAt: "2026-07-09T09:00:00.000Z" }),
      ],
      currency: "THB",
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-09-01T00:00:00.000Z",
    });
    expect(lines.map((c) => [c.name, c.amountMinor, c.count])).toEqual([
      ["Boende", 900_00, 1],
      ["Mat", 450_00, 2],
    ]);
    expect(sumSpendingCategories(lines)).toBe(1_350_00);
  });

  it("counts nothing before the period starts", () => {
    expect(
      spendingCategoriesInWindow({
        transactions: [
          tx({ amountMinor: 500_00, category: "Mat", occurredAt: "2026-08-10T09:00:00.000Z" }),
        ],
        currency: "THB",
        startAt: null,
        endAt: null,
      }),
    ).toEqual([]);
  });
});

const PERIOD = {
  scope: "period" as const,
  startAt: "2026-08-01T00:00:00.000Z",
  endAt: "2026-09-01T00:00:00.000Z",
  monthKey: "2026-08",
  timeZone: TZ,
};

describe("ovrigtTitleBreakdown", () => {
  const ledger = [
    tx({
      amountMinor: 20_000_00,
      description: "Testhyra",
      category: null,
      occurredAt: "2026-08-13T16:27:00.000Z",
    }),
    tx({
      amountMinor: 1_300_00,
      description: "QA-W-settle",
      category: "  ",
      occurredAt: "2026-08-23T11:23:00.000Z",
    }),
    tx({
      amountMinor: 1_200_00,
      description: "Utgift",
      category: UNCATEGORISED_SPEND_NAME,
      occurredAt: "2026-08-19T07:00:00.000Z",
    }),
    tx({
      amountMinor: 600_00,
      description: "Lunch",
      category: null,
      occurredAt: "2026-08-20T07:00:00.000Z",
    }),
    tx({
      amountMinor: 400_00,
      description: "Lunch",
      category: null,
      occurredAt: "2026-08-21T07:00:00.000Z",
    }),
    tx({
      amountMinor: 10_00,
      description:
        "Withdrawal/transfer/payment from your account X6591 of Bt 10.00 via MOBILE",
      category: null,
      occurredAt: "2026-08-22T07:00:00.000Z",
    }),
    tx({
      amountMinor: 20_00,
      description: "Payment from your account X6591 of Bt 20.00 via MOBILE",
      category: null,
      occurredAt: "2026-08-22T08:00:00.000Z",
    }),
    tx({ description: "   ", amountMinor: 5_00, category: null, occurredAt: "2026-08-24T07:00:00.000Z" }),
    // Same window, but a real category — must stay out of the Övrigt titles.
    tx({ amountMinor: 2_488_00, category: "Mat", description: "Matsal", occurredAt: "2026-08-18T07:00:00.000Z" }),
    // Income, transfer, unconfirmed, other currency, and the exclusive window end.
    tx({
      amountMinor: 800_00,
      description: "QA-W-income",
      transactionType: "income",
      direction: "credit",
      category: null,
      occurredAt: "2026-08-23T11:29:00.000Z",
    }),
    tx({
      amountMinor: 900_00,
      description: "Överföring",
      transactionType: "transfer",
      category: null,
      occurredAt: "2026-08-12T07:00:00.000Z",
    }),
    tx({
      amountMinor: 700_00,
      description: "Väntar",
      category: null,
      status: "needs_review",
      occurredAt: "2026-08-12T08:00:00.000Z",
    }),
    tx({
      amountMinor: 650_00,
      description: "Svenskt",
      category: null,
      currency: "SEK",
      occurredAt: "2026-08-12T09:00:00.000Z",
    }),
    tx({
      amountMinor: 80_00,
      description: "Efter perioden",
      category: null,
      occurredAt: "2026-09-01T00:00:00.000Z",
    }),
    tx({
      amountMinor: 70_00,
      description: "Före perioden",
      category: null,
      occurredAt: "2026-07-31T12:00:00.000Z",
    }),
  ];

  it("lists humanized Övrigt titles, biggest first, and sums to that category", () => {
    const titles = ovrigtTitleBreakdown({
      transactions: ledger,
      currency: "THB",
      ...PERIOD,
      limit: 100,
    });
    expect(titles.map((line) => [line.title, line.amountMinor, line.count])).toEqual([
      ["Testhyra", 20_000_00, 1],
      ["QA-W-settle", 1_300_00, 1],
      ["Utgift", 1_205_00, 2],
      ["Lunch", 1_000_00, 2],
      ["Utgift (bank-SMS)", 30_00, 2],
    ]);
    const categories = spendingCategoriesInWindow({
      transactions: ledger,
      currency: "THB",
      startAt: PERIOD.startAt,
      endAt: PERIOD.endAt,
    });
    const ovrigt = categories.find((line) => line.name === UNCATEGORISED_SPEND_NAME);
    expect(ovrigt?.amountMinor).toBe(titles.reduce((sum, line) => sum + line.amountMinor, 0));
    expect(ovrigt?.count).toBe(titles.reduce((sum, line) => sum + line.count, 0));
    expect(sumSpendingCategories(categories)).toBe((ovrigt?.amountMinor ?? 0) + 2_488_00);
  });

  it("keeps at most five titles, still the biggest", () => {
    expect(OVRIGT_TITLE_LIMIT).toBe(5);
    const many = Array.from({ length: 6 }, (_, index) =>
      tx({
        amountMinor: (index + 1) * 100_00,
        description: `Titel ${index + 1}`,
        category: null,
        occurredAt: "2026-08-10T09:00:00.000Z",
      }),
    );
    const titles = ovrigtTitleBreakdown({
      transactions: many,
      currency: "THB",
      ...PERIOD,
    });
    expect(titles).toHaveLength(5);
    expect(titles.map((line) => line.amountMinor)).toEqual([
      600_00, 500_00, 400_00, 300_00, 200_00,
    ]);
    expect(titles.reduce((sum, line) => sum + line.amountMinor, 0)).toBeLessThan(
      many.reduce((sum, line) => sum + line.amountMinor, 0),
    );
  });

  it("breaks equal amounts with Swedish title order", () => {
    const titles = ovrigtTitleBreakdown({
      transactions: [
        tx({ amountMinor: 100_00, description: "Åka", category: null }),
        tx({ amountMinor: 100_00, description: "Apotek", category: null }),
        tx({ amountMinor: 100_00, description: "Zebra", category: null }),
      ],
      currency: "THB",
      ...PERIOD,
    });
    expect(titles.map((line) => line.title)).toEqual(["Apotek", "Zebra", "Åka"]);
  });

  it("uses the calendar month when Analys scope is Månad", () => {
    const titles = ovrigtTitleBreakdown({
      transactions: [
        tx({
          amountMinor: 500_00,
          description: "Augusti",
          category: null,
          occurredAt: "2026-08-31T16:00:00.000Z",
        }),
        tx({
          amountMinor: 900_00,
          description: "September",
          category: null,
          occurredAt: "2026-08-31T18:00:00.000Z",
        }),
        tx({
          amountMinor: 300_00,
          description: "Mat i september",
          category: "Mat",
          occurredAt: "2026-09-02T08:00:00.000Z",
        }),
      ],
      currency: "THB",
      scope: "month",
      startAt: "2026-08-01T00:00:00.000Z",
      endAt: "2026-10-01T00:00:00.000Z",
      monthKey: "2026-09",
      timeZone: TZ,
    });
    expect(titles.map((line) => [line.title, line.amountMinor])).toEqual([
      ["September", 900_00],
    ]);
    const monthLines = spendingCategoriesByMonthKey({
      transactions: [
        tx({
          amountMinor: 500_00,
          description: "Augusti",
          category: null,
          occurredAt: "2026-08-31T16:00:00.000Z",
        }),
        tx({
          amountMinor: 900_00,
          description: "September",
          category: null,
          occurredAt: "2026-08-31T18:00:00.000Z",
        }),
      ],
      currency: "THB",
      timeZone: TZ,
    });
    expect(monthLines["2026-09"]?.[0]?.amountMinor).toBe(900_00);
    expect(monthLines["2026-08"]?.[0]?.amountMinor).toBe(500_00);
  });
});
