import { describe, expect, it } from "vitest";
import { drillSummaryFromRows } from "./drill-summary";

describe("drillSummaryFromRows", () => {
  it("equals the visible Övrigt rows, not the unfiltered period", () => {
    const ovrigt = [
      { transactionType: "expense", direction: "debit" as const, amountMinor: 2_000_000 },
      { transactionType: "expense", direction: "debit" as const, amountMinor: 649_200 },
    ];
    const summary = drillSummaryFromRows(ovrigt, {
      category: "Övrigt",
      period: "cycle",
      filter: "expense",
    });
    const signedList = ovrigt.reduce((sum, tx) => sum - tx.amountMinor, 0);
    expect(summary.amountMinor).toBe(-signedList);
    expect(summary.amountMinor).toBe(2_649_200);
    expect(summary.amountMinor).not.toBe(2_898_000);
    expect(summary).toMatchObject({
      label: "Övrigt i perioden",
      count: 2,
      expenseOnly: true,
    });
  });

  it("lets an expense credit reduce the card so it still matches the list", () => {
    const summary = drillSummaryFromRows(
      [
        { transactionType: "expense", direction: "debit", amountMinor: 1_000 },
        { transactionType: "expense", direction: "credit", amountMinor: 200 },
      ],
      { category: "Mat", period: "month", filter: "expense" },
    );
    expect(summary.label).toBe("Mat i månaden");
    expect(summary.amountMinor).toBe(800);
    expect(summary.count).toBe(2);
  });

  it("counts every visible row", () => {
    const summary = drillSummaryFromRows(
      Array.from({ length: 9 }, () => ({
        transactionType: "expense",
        direction: "debit" as const,
        amountMinor: 100,
      })),
      { category: "Övrigt", period: "cycle", filter: "expense" },
    );
    expect(summary.count).toBe(9);
    expect(summary.amountMinor).toBe(900);
  });
});
