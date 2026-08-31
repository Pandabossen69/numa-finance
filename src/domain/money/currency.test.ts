import { describe, expect, it } from "vitest";
import { parseCurrencyToken } from "./currency";

describe("parseCurrencyToken", () => {
  it("maps US$ / USD / DOLLAR to USD", () => {
    expect(parseCurrencyToken("USD")).toBe("USD");
    expect(parseCurrencyToken("US$")).toBe("USD");
    expect(parseCurrencyToken("dollar")).toBe("USD");
  });

  it("does not treat a bare $ as USD (Thai OCR)", () => {
    expect(parseCurrencyToken("$")).toBeNull();
  });
});
