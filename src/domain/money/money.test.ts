import { describe, expect, it } from "vitest";
import {
  addMoney,
  CurrencyMismatchError,
  formatMoney,
  fromMajorUnits,
  money,
  parseUiAmountToMinor,
  sanitizeMoneyDescription,
  subtractMoney,
} from "@/domain/money";
import { convertWithRate, type FxRate } from "@/domain/money/fx";

function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");
}

describe("Money", () => {
  it("stores THB in minor units", () => {
    expect(fromMajorUnits(750, "THB").amountMinor).toBe(75000);
    expect(fromMajorUnits(100.5, "SEK").amountMinor).toBe(10050);
  });

  it("adds and subtracts same currency", () => {
    const a = money(10005804, "THB");
    const b = money(60000, "THB");
    expect(subtractMoney(a, b).amountMinor).toBe(9945804);
    expect(addMoney(b, money(3500, "THB")).amountMinor).toBe(63500);
  });

  it("rejects mixed-currency addition", () => {
    expect(() => addMoney(money(100, "THB"), money(100, "SEK"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("formats THB and SEK for Swedish UI", () => {
    expect(normalizeSpaces(formatMoney(money(1005804, "THB")))).toBe(
      "10 058,04 THB",
    );
    expect(normalizeSpaces(formatMoney(money(1245000, "SEK")))).toBe(
      "12 450,00 kr",
    );
  });

  it("sanitizes legacy ฿ glyphs in stored movement labels", () => {
    expect(
      sanitizeMoneyDescription("− Utgift ฿750,00 · …X6591 · saldo ฿10 758,04"),
    ).toBe("− Utgift 750,00 THB · …X6591 · saldo 10 758,04 THB");
    expect(sanitizeMoneyDescription("Lunch 150 THB")).toBe("Lunch 150 THB");
  });

  it("parses Swedish UI amounts without using bank source rules", () => {
    expect(parseUiAmountToMinor("10 058,04")).toBe(1005804);
    expect(parseUiAmountToMinor("750")).toBe(75000);
    expect(parseUiAmountToMinor("65,5")).toBe(6550);
  });

  it("converts only with explicit FX rate", () => {
    const rate: FxRate = {
      baseCurrency: "THB",
      quoteCurrency: "SEK",
      rate: 0.266,
      asOf: "2026-08-09T00:00:00.000Z",
      source: "static-test",
    };
    const result = convertWithRate(money(4682000, "THB"), "SEK", rate);
    expect(result.converted.currency).toBe("SEK");
    expect(result.rate).toBe(0.266);
    expect(result.converted.amountMinor).toBe(Math.round(46820 * 0.266 * 100));
  });
});
