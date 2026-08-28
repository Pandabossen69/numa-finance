import { describe, expect, it } from "vitest";
import { formatSvGroupedNumber } from "./MoneyDisplay";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./MoneyDisplay.tsx", import.meta.url), "utf8");

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

describe("formatSvGroupedNumber", () => {
  it("uses non-breaking grouping so thousands cannot wrap mid-number", () => {
    const text = formatSvGroupedNumber(1234567.89, 2);
    expect(text).toContain("\u00A0");
    expect(text).not.toMatch(/\d \d/);
    expect(normalizeSpaces(text)).toBe("1 234 567,89");
  });

  it("keeps compact whole amounts grouped without a wrapping space", () => {
    const text = formatSvGroupedNumber(12450, 0);
    expect(text).toContain("\u00A0");
    expect(normalizeSpaces(text)).toBe("12 450");
  });
});

describe("MoneyDisplay wrapping contract", () => {
  it("defaults wrap to false and always applies nowrap plus tabular lining figures", () => {
    expect(src).toContain("wrap = false");
    expect(src).toContain("is-nowrap");
    expect(src).toContain("formatSvGroupedNumber");
    expect(src).toContain("numa-money-amt");
  });
});
