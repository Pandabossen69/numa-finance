import { describe, expect, it } from "vitest";
import { senasteRowCategoryLabel } from "./senaste-row";

describe("senasteRowCategoryLabel", () => {
  it("keeps a saved category on income and on expenses", () => {
    expect(
      senasteRowCategoryLabel({
        category: "Lön",
        transactionType: "income",
        direction: "credit",
      }),
    ).toBe("Lön");
    expect(
      senasteRowCategoryLabel({
        category: "Mat",
        transactionType: "expense",
        direction: "debit",
      }),
    ).toBe("Mat");
    expect(
      senasteRowCategoryLabel({
        category: "Övrigt",
        transactionType: "expense",
        direction: "debit",
      }),
    ).toBe("Övrigt");
  });

  it("fills a blank income row with Inkomst", () => {
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "income",
        direction: "credit",
      }),
    ).toBe("Inkomst");
    expect(
      senasteRowCategoryLabel({
        category: "  ",
        transactionType: "income",
        direction: "credit",
      }),
    ).toBe("Inkomst");
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "income",
        direction: "debit",
      }),
    ).toBe("Inkomst");
    // Trukks / Alltid ID: credit with no saved category.
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "unknown",
        direction: "credit",
      }),
    ).toBe("Inkomst");
  });

  it("fills a blank expense with Övrigt", () => {
    // Dator / Unseen: expense with a missing or blank category.
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "expense",
        direction: "debit",
      }),
    ).toBe("Övrigt");
    expect(
      senasteRowCategoryLabel({
        category: "  ",
        transactionType: "expense",
        direction: "debit",
      }),
    ).toBe("Övrigt");
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "unknown",
        direction: "debit",
      }),
    ).toBe("Övrigt");
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "expense",
        direction: "credit",
      }),
    ).toBe("Övrigt");
  });

  it("never leaves Senaste meta blank", () => {
    const types = [
      "expense",
      "income",
      "transfer",
      "cash_withdrawal",
      "refund",
      "adjustment",
      "unknown",
      null,
    ] as const;
    const directions = ["debit", "credit", null] as const;
    for (const transactionType of types) {
      for (const direction of directions) {
        const label = senasteRowCategoryLabel({
          category: null,
          transactionType,
          direction,
        });
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
