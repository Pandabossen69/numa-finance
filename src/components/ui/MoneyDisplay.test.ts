import { describe, expect, it } from "vitest";
import { formatSvGroupedNumber, svAmountGroups } from "./MoneyDisplay";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./MoneyDisplay.tsx", import.meta.url), "utf8");

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

describe("formatSvGroupedNumber", () => {
  it("uses a thin no-break grouping so thousands cannot wrap or open a digit hole", () => {
    const text = formatSvGroupedNumber(1234567.89, 2);
    expect(text).toContain("\u202F");
    expect(text).not.toContain("\u00A0");
    expect(text).not.toMatch(/\d \d/);
    expect(normalizeSpaces(text)).toBe("1 234 567,89");
    expect(svAmountGroups(29274.79, 2)).toEqual(["29", "274,79"]);
  });

  it("keeps compact whole amounts grouped without a wrapping space", () => {
    const text = formatSvGroupedNumber(12450, 0);
    expect(text).toContain("\u202F");
    expect(normalizeSpaces(text)).toBe("12 450");
  });
});

describe("MoneyDisplay wrapping contract", () => {
  it("joins nowrap as its own class and paints grouping as a thin sep, not a second number", () => {
    expect(src).toContain("wrap = false");
    expect(src).toContain('"is-nowrap"');
    expect(src).toContain('.join(" ")');
    expect(src).toContain("numa-money-sep");
    expect(src).toContain("AmountRuns");
    expect(src).not.toContain("${alignClass}${wrap");
  });
});
