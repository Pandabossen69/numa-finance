import { describe, expect, it } from "vitest";
import { resolveScreenshotImport } from "./resolve-screenshot-import";
import { resolveBankAppPostedCurrency } from "./bank-app-parsers";
import { resolveImageCurrency } from "./image-currency";

describe("currency printed on the image", () => {
  it("reads THB from ฿, บาท and THB and does not keep a model EUR", () => {
    expect(resolveImageCurrency({ explicit: "EUR", texts: ["Totalt 61,00 ฿"] })).toBe("THB");
    expect(resolveImageCurrency({ explicit: "EUR", texts: ["6100 บาท"] })).toBe("THB");
    expect(resolveImageCurrency({ explicit: null, texts: ["KAFE Z4A QA 61.00 THB"] })).toBe(
      "THB",
    );
    expect(
      resolveBankAppPostedCurrency({
        currency: "EUR",
        rawText: "−63.00 บาท",
        screenText: "Kasikorn",
      }),
    ).toBe("THB");
    expect(
      resolveBankAppPostedCurrency({
        currency: "EUR",
        rawText: "6,60 €",
        screenText: "248.00 THB, 1 THB = 0.02661 EUR",
      }),
    ).toBe("EUR");
  });

  it("leaves the currency unset when the image does not name one", () => {
    expect(resolveImageCurrency({ explicit: null, texts: ["KAFE Z4A QA 61.00"] })).toBeNull();
    expect(resolveImageCurrency({ explicit: "EUR", texts: ["6,60 €"] })).toBe("EUR");
  });

  it("uses the account currency when the receipt does not show one", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [
          {
            direction: "debit",
            amountMinor: 6_100,
            currency: null,
            balanceAfterMinor: null,
            occurredAt: null,
            description: "KAFE QA",
            confidence: 0.9,
            rawPayload: {},
          },
        ],
        rawMetadata: {
          detectedKind: "receipt",
          fullText: "KAFE QA\n61.00",
        },
      },
      [],
      { accountCurrency: "SEK" },
    );
    expect(resolved.kind).toBe("receipt_or_other");
    expect(resolved.currency).toBe("SEK");
    expect(resolved.suggestedAmountMinor).toBe(6_100);
  });

  it("keeps THB from the image even when the account is EUR", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [
          {
            direction: "debit",
            amountMinor: 6_100,
            currency: "EUR",
            balanceAfterMinor: null,
            occurredAt: null,
            description: "KAFE QA",
            confidence: 0.9,
            rawPayload: {},
          },
        ],
        rawMetadata: {
          detectedKind: "receipt",
          fullText: "KAFE QA\n61.00 บาท",
        },
      },
      [],
      { accountCurrency: "EUR" },
    );
    expect(resolved.currency).toBe("THB");
  });
});
