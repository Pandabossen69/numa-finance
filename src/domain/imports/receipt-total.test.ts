import { describe, expect, it } from "vitest";
import {
  extractPaidTotalFromText,
  resolveReceiptPaidAmountMinor,
} from "./receipt-total";
import { majorToMinor } from "./amount-parse";

describe("majorToMinor baht symbol", () => {
  it("parses ฿ amounts", () => {
    expect(majorToMinor("฿749")).toBe(74_900);
    expect(majorToMinor("฿875")).toBe(87_500);
    expect(majorToMinor("-฿126")).toBeNull();
  });
});

describe("extractPaidTotalFromText (Grab + general)", () => {
  it("prefers Grab Final total over earlier order total", () => {
    const text = `
How was your delivery?
Panapol Piyachaikamon
฿875
Adjustment
-฿126
Final total
฿749
View details
`;
    const hit = extractPaidTotalFromText(text);
    expect(hit?.amountMinor).toBe(74_900);
    expect(hit?.labelKey).toBe("final_total");
  });

  it("reads Final total on the same line", () => {
    expect(
      extractPaidTotalFromText("Final total ฿749")?.amountMinor,
    ).toBe(74_900);
  });

  it("ignores adjustment / discount lines", () => {
    const hit = extractPaidTotalFromText(`
Subtotal 500
Discount -50
Final total 450
`);
    expect(hit?.amountMinor).toBe(45_000);
  });

  it("prefers amount paid over plain total", () => {
    const hit = extractPaidTotalFromText(`
Total 1,200.00
Amount paid 1,050.00
`);
    expect(hit?.amountMinor).toBe(105_000);
    expect(hit?.labelKey).toBe("amount_paid");
  });

  it("supports Swedish att betala", () => {
    expect(
      extractPaidTotalFromText("Att betala 189,00 kr")?.amountMinor,
    ).toBe(18_900);
  });
});

describe("resolveReceiptPaidAmountMinor", () => {
  it("overrides wrong vision amount with Final total from text", () => {
    const grab = `
฿875
Adjustment -฿126
Final total
฿749
`;
    expect(
      resolveReceiptPaidAmountMinor({
        visionAmountMinor: 87_500,
        fullText: grab,
      }),
    ).toBe(74_900);
  });

  it("falls back to vision when no label found", () => {
    expect(
      resolveReceiptPaidAmountMinor({
        visionAmountMinor: 12_500,
        fullText: "some blurry noise",
      }),
    ).toBe(12_500);
  });
});
