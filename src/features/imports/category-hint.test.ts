import { describe, expect, it } from "vitest";
import {
  CAPTURE_CATEGORIES,
  KNOWN_CATEGORY_HINTS,
  categoryFromEvents,
  resolveCategoryFromHint,
} from "./category-hint";

describe("resolveCategoryFromHint", () => {
  it("accepts a known category regardless of case and surrounding space", () => {
    expect(resolveCategoryFromHint("Transport")).toBe("Transport");
    expect(resolveCategoryFromHint("  övrigt ")).toBe("Övrigt");
  });

  it("maps Resor and Travel to Transport — Resor is not a NUMA category", () => {
    expect(CAPTURE_CATEGORIES).not.toContain("Resor");
    expect(resolveCategoryFromHint("Resor")).toBe("Transport");
    expect(resolveCategoryFromHint("Travel")).toBe("Transport");
    expect(resolveCategoryFromHint("  travel ")).toBe("Transport");
    expect(resolveCategoryFromHint("Flyg")).toBe("Transport");
  });

  it("ignores empty and non-string hints", () => {
    expect(resolveCategoryFromHint("")).toBeNull();
    expect(resolveCategoryFromHint("   ")).toBeNull();
    expect(resolveCategoryFromHint(null)).toBeNull();
    expect(resolveCategoryFromHint(undefined)).toBeNull();
    expect(resolveCategoryFromHint(12 as unknown as string)).toBeNull();
  });

  it("does not treat an unknown word as a category", () => {
    expect(resolveCategoryFromHint("Widgets")).toBeNull();
  });
});

describe("categoryFromEvents", () => {
  it("uses the first debit hint", () => {
    expect(
      categoryFromEvents([
        { direction: "credit", categoryHint: "Shopping" },
        { direction: "debit", categoryHint: "boende" },
      ]),
    ).toBe("Boende");
  });

  it("keeps Mat only when there is no hint", () => {
    expect(categoryFromEvents([])).toBe("Mat");
    expect(categoryFromEvents(undefined)).toBe("Mat");
    expect(categoryFromEvents([{ direction: "debit", categoryHint: "  " }])).toBe(
      "Mat",
    );
  });

  it("sends an unknown hint to Övrigt, not Mat", () => {
    expect(
      categoryFromEvents([{ direction: "debit", categoryHint: "Widgets" }]),
    ).toBe("Övrigt");
    expect(
      categoryFromEvents([{ direction: "debit", categoryHint: "Restaurant" }]),
    ).toBe("Mat");
  });

  it.each(KNOWN_CATEGORY_HINTS)("maps %s → %s", (hint, category) => {
    expect(resolveCategoryFromHint(hint)).toBe(category);
    expect(
      categoryFromEvents([{ direction: "debit", categoryHint: hint }]),
    ).toBe(category);
  });
});
