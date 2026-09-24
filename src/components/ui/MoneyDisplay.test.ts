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
    expect(svAmountGroups(15674.79, 2)).toEqual(["15", "674,79"]);
    expect(svAmountGroups(110200, 0)).toEqual(["110", "200"]);
    expect(svAmountGroups(96600, 0)).toEqual(["96", "600"]);
  });

  it("keeps compact whole amounts grouped without a wrapping space", () => {
    const text = formatSvGroupedNumber(12450, 0);
    expect(text).toContain("\u202F");
    expect(normalizeSpaces(text)).toBe("12 450");
  });
});

describe("MoneyDisplay signed tone", () => {
  it("colors only a strictly negative amount as alarm and a strictly positive amount as green", () => {
    expect(src).toContain('tone?: "neutral" | "signed"');
    expect(src).toContain('tone === "signed" && safeMinor < 0');
    expect(src).toContain('? "text-[var(--numa-alarm)]"');
    expect(src).toContain('tone === "signed" && safeMinor > 0');
    expect(src).toContain('? "text-[var(--numa-positive)]"');
    expect(src).not.toMatch(/safeMinor\s*<=\s*0/);
    expect(src).not.toMatch(/safeMinor\s*>=\s*0/);
  });
});

describe("MoneyDisplay wrapping contract", () => {
  it("joins nowrap as its own class and paints grouping as flex groups, not a second number", () => {
    expect(src).toContain("wrap = false");
    expect(src).toContain('"is-nowrap"');
    expect(src).toContain('.join(" ")');
    expect(src).toContain("numa-money-groups");
    expect(src).toContain("AmountRuns");
    expect(src).not.toContain("numa-money-sep");
    expect(src).not.toContain("${alignClass}${wrap");
  });
});
