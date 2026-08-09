import { describe, expect, it } from "vitest";
import {
  addMoney,
  coerceMinor,
  CurrencyMismatchError,
  formatMoney,
  fromMajorUnits,
  money,
  moneyFromUnknown,
  parseUiAmountToMinor,
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

  it("coerces DB/JSON minor units into safe integers", () => {
    expect(coerceMinor("1005804")).toBe(1005804);
    expect(coerceMinor(1005804.9)).toBe(1005804);
    expect(moneyFromUnknown("62000", "THB").amountMinor).toBe(62000);
    expect(moneyFromUnknown(undefined, "THB").amountMinor).toBe(0);
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
    expect(normalizeSpaces(formatMoney(money(1005804, "THB")))).toBe("฿10 058,04");
    expect(normalizeSpaces(formatMoney(money(1245000, "SEK")))).toBe("12 450,00 kr");
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
