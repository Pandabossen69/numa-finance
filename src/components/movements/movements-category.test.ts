import { describe, expect, it } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import {
  matchesCategory,
  spendCategoryName,
  toggleCategory,
} from "./movements-category";

describe("spendCategoryName", () => {
  it("uses Övrigt for blank or missing categories", () => {
    expect(spendCategoryName(null)).toBe(UNCATEGORISED_SPEND_NAME);
    expect(spendCategoryName("")).toBe(UNCATEGORISED_SPEND_NAME);
    expect(spendCategoryName("   ")).toBe(UNCATEGORISED_SPEND_NAME);
    expect(spendCategoryName("Mat")).toBe("Mat");
    expect(spendCategoryName("  Mat  ")).toBe("Mat");
  });
});

describe("matchesCategory", () => {
  it("lets every row through when no category is selected", () => {
    expect(matchesCategory("Mat", null)).toBe(true);
    expect(matchesCategory(null, null)).toBe(true);
  });

  it("keeps only the selected category, including Övrigt for blanks", () => {
    expect(matchesCategory("Mat", "Mat")).toBe(true);
    expect(matchesCategory("Transport", "Mat")).toBe(false);
    expect(matchesCategory(null, "Övrigt")).toBe(true);
    expect(matchesCategory("  ", "Övrigt")).toBe(true);
    expect(matchesCategory("Mat", "Övrigt")).toBe(false);
  });
});

describe("toggleCategory", () => {
  it("selects a category, then clears the same tap", () => {
    expect(toggleCategory(null, "Mat")).toBe("Mat");
    expect(toggleCategory("Mat", "Mat")).toBeNull();
    expect(toggleCategory("Mat", "Transport")).toBe("Transport");
  });
});
