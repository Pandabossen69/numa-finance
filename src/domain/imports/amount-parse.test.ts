import { describe, expect, it } from "vitest";
import {
  majorToMinor,
  minorToUiAmount,
  ocrQualityMessage,
} from "./amount-parse";

describe("majorToMinor", () => {
  it("parses US bank style with thousands comma", () => {
    expect(majorToMinor("3,400.00")).toBe(340_000);
    expect(majorToMinor("10,108.04")).toBe(1_010_804);
    expect(majorToMinor("50.00")).toBe(5_000);
  });

  it("parses EU/Swedish decimal comma", () => {
    expect(majorToMinor("3400,00")).toBe(340_000);
    expect(majorToMinor("10 108,04")).toBe(1_010_804);
    expect(majorToMinor("3.400,00")).toBe(340_000);
  });

  it("parses bare numbers and currency prefixes", () => {
    expect(majorToMinor(85.5)).toBe(8_550);
    expect(majorToMinor("Bt 300.00")).toBe(30_000);
    expect(majorToMinor("THB 785")).toBe(78_500);
    expect(majorToMinor("785")).toBe(78_500);
  });

  it("rejects garbage", () => {
    expect(majorToMinor(null)).toBeNull();
    expect(majorToMinor("")).toBeNull();
    expect(majorToMinor("abc")).toBeNull();
    expect(majorToMinor(-1)).toBeNull();
  });
});

describe("minorToUiAmount", () => {
  it("formats with Swedish decimal comma", () => {
    expect(minorToUiAmount(340_000)).toBe("3400,00");
    expect(minorToUiAmount(1_010_804)).toBe("10108,04");
  });
});

describe("ocrQualityMessage", () => {
  it("fails when no amount", () => {
    expect(
      ocrQualityMessage({
        confidence: 0.9,
        hasAmount: false,
        kind: "receipt",
      }).level,
    ).toBe("fail");
  });

  it("warns on medium confidence", () => {
    expect(
      ocrQualityMessage({
        confidence: 0.65,
        hasAmount: true,
        kind: "receipt",
      }).level,
    ).toBe("warn");
  });

  it("fails on very low confidence", () => {
    expect(
      ocrQualityMessage({
        confidence: 0.4,
        hasAmount: true,
        kind: "bank_sms",
      }).level,
    ).toBe("fail");
  });
});
