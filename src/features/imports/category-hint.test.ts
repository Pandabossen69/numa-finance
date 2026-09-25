import { describe, expect, it } from "vitest";
import { categoryFromEvents, resolveCategoryFromHint } from "./category-hint";

describe("resolveCategoryFromHint", () => {
  it("accepts a known category regardless of case and surrounding space", () => {
    expect(resolveCategoryFromHint("Transport")).toBe("Transport");
    expect(resolveCategoryFromHint("  övrigt ")).toBe("Övrigt");
  });

  it("ignores unknown, empty, and non-string hints", () => {
    expect(resolveCategoryFromHint("Restaurant")).toBeNull();
    expect(resolveCategoryFromHint("Resor")).toBeNull();
    expect(resolveCategoryFromHint("")).toBeNull();
    expect(resolveCategoryFromHint("   ")).toBeNull();
    expect(resolveCategoryFromHint(null)).toBeNull();
    expect(resolveCategoryFromHint(undefined)).toBeNull();
    expect(resolveCategoryFromHint(12 as unknown as string)).toBeNull();
  });
});

describe("categoryFromEvents", () => {
  it("uses the first debit hint and otherwise stays on Mat", () => {
    expect(
      categoryFromEvents([
        { direction: "credit", categoryHint: "Shopping" },
        { direction: "debit", categoryHint: "boende" },
      ]),
    ).toBe("Boende");
    expect(
      categoryFromEvents([{ direction: "debit", categoryHint: "Restaurant" }]),
    ).toBe("Mat");
    expect(categoryFromEvents([])).toBe("Mat");
    expect(categoryFromEvents(undefined)).toBe("Mat");
  });
});
