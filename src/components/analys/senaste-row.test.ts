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
        transactionType: "unknown",
        direction: "credit",
      }),
    ).toBe("Inkomst");
  });

  it("does not invent a category for blank expenses or transfers", () => {
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "expense",
        direction: "debit",
      }),
    ).toBeNull();
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "transfer",
        direction: "credit",
      }),
    ).toBeNull();
    expect(
      senasteRowCategoryLabel({
        category: null,
        transactionType: "refund",
        direction: "credit",
      }),
    ).toBeNull();
  });
});
