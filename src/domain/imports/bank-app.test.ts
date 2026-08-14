import { describe, expect, it } from "vitest";
import {
  europeanAmountToMinor,
  sanitizeOcrDigitNoise,
  westernAmountToMinor,
} from "./ocr-amounts";
import {
  parseBankAppOccurredAt,
  parseBankAppVisionRows,
  parseBunqDetailFromText,
  selectImportableBankAppEvents,
} from "./bank-app-parsers";
import { buildBankAppFingerprint } from "@/domain/finance/fingerprint";
import { sanitizeBankSmsText, BangkokBankSmsParser } from "./bank-parsers";
import { resolveScreenshotImport } from "./resolve-screenshot-import";

describe("ocr amount helpers", () => {
  it("parses Bangkok Bank western amounts", () => {
    expect(westernAmountToMinor("10,758.04")).toBe(1_075_804);
    expect(westernAmountToMinor("750.00")).toBe(75_000);
  });

  it("parses European / Swedish bank UI amounts", () => {
    expect(europeanAmountToMinor("6,60")).toBe(660);
    expect(europeanAmountToMinor("9,30")).toBe(930);
    expect(europeanAmountToMinor("248.00")).toBe(24_800);
    expect(europeanAmountToMinor("1.234,56")).toBe(123_456);
  });

  it("sanitizes OCR digit noise", () => {
    expect(sanitizeOcrDigitNoise("1O,758.O4")).toContain("0");
    expect(westernAmountToMinor("1O,758.04")).toBe(1_075_804);
  });
});

describe("bangkok sms OCR hardening", () => {
  it("repairs common OCR typos before parse", () => {
    const dirty =
      "WithdrawaI from your account X6591 of Bt 5O.00 via MOBILE; the available balance is Bt 12,028.04.";
    const text = sanitizeBankSmsText(dirty);
    const parsed = new BangkokBankSmsParser().parse({
      institution: "Bangkok Bank",
      text,
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.amountMinor).toBe(5000);
    expect(parsed[0]?.balanceAfterMinor).toBe(1_202_804);
  });
});

describe("bank app bunq-style", () => {
  it("parses Swedish datetime", () => {
    expect(parseBankAppOccurredAt("23 juli 2026 16:46")).toBe(
      "2026-07-23T16:46",
    );
  });

  it("uses THB original from Grab detail and fingerprints stably", () => {
    const rows = parseBankAppVisionRows(
      [
        {
          merchant: "Grab",
          direction: "debit",
          amountMajor: 6.6,
          currency: "EUR",
          originalAmountMajor: 248,
          originalCurrency: "THB",
          occurredAt: "2026-07-23T16:46",
          failed: false,
        },
      ],
      { institutionHint: "bunq", fullText: "ZeroFX Grab onlinebetalning" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountMinor).toBe(24_800);
    expect(rows[0]?.currency).toBe("THB");

    const fp = buildBankAppFingerprint({
      institution: "bunq",
      merchant: "Grab",
      direction: "debit",
      amountMinor: 660,
      currency: "EUR",
      occurredAt: "2026-07-23T16:46:00",
      originalAmountMinor: 24_800,
      originalCurrency: "THB",
    });
    const again = buildBankAppFingerprint({
      institution: "bunq",
      merchant: "WWW.GRAB.COM",
      direction: "debit",
      amountMinor: 660,
      currency: "EUR",
      occurredAt: "2026-07-23T16:46",
      originalAmountMinor: 24_800,
      originalCurrency: "THB",
    });
    expect(fp.fingerprint).toBe(again.fingerprint);
  });

  it("skips failed / strikethrough rows", () => {
    const rows = parseBankAppVisionRows([
      {
        merchant: "Maria Bratten",
        direction: "credit",
        amountMajor: 19,
        currency: "EUR",
        occurredAt: "2026-07-23T12:00",
        failed: true,
        statusText: "Card Top Up Failed",
      },
      {
        merchant: "Grab",
        direction: "debit",
        amountMajor: 6.6,
        currency: "EUR",
        originalAmountMajor: 248,
        originalCurrency: "THB",
        occurredAt: "2026-07-23T16:46",
      },
    ]);
    const result = selectImportableBankAppEvents(rows, []);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.selectedBatch).toHaveLength(1);
    expect(result.skippedFailedCount).toBe(1);
    expect(result.selectedBatch[0]?.merchant).toBe("Grab");
  });

  it("never double-imports the same bank-app expense", () => {
    const rows = parseBankAppVisionRows([
      {
        merchant: "Grab",
        direction: "debit",
        amountMajor: 6.6,
        currency: "EUR",
        originalAmountMajor: 248,
        originalCurrency: "THB",
        occurredAt: "2026-07-23T16:46",
      },
    ]);
    const first = selectImportableBankAppEvents(rows, []);
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    const known = first.selectedBatch.map((e) => e.fingerprint.fingerprint);
    const again = selectImportableBankAppEvents(rows, known);
    expect(again.status).toBe("all_known");
  });

  it("parses bunq detail text heuristic with THB FX line", () => {
    const text = `onlinebetalning
Grab >
23 juli 2026 16:46
6,60 €
WWW.GRAB.COM BANGKOK, TH
248.00 THB, 1 THB = 0.02661 EUR
Sparat med ZeroFX 0,20 €`;
    const parsed = parseBunqDetailFromText(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.failed).toBe(false);
    expect(parsed[0]?.amountMinor).toBe(24_800);
    expect(parsed[0]?.currency).toBe("THB");
    expect(parsed[0]?.merchant.toLowerCase()).toContain("grab");
  });

  it("resolveScreenshotImport routes bank_app metadata", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [
          {
            direction: "debit",
            amountMinor: 24_800,
            currency: "THB",
            balanceAfterMinor: null,
            occurredAt: "2026-07-23T16:46",
            description: "Grab",
            confidence: 0.9,
            rawPayload: {
              merchant: "Grab",
              originalAmountMajor: 248,
              originalCurrency: "THB",
              occurredAt: "2026-07-23T16:46",
            },
          },
        ],
        rawMetadata: {
          detectedKind: "bank_app_detail",
          institutionHint: "bunq",
          fullText: "Grab onlinebetalning ZeroFX 6,60 € 248.00 THB",
          transactions: [
            {
              merchant: "Grab",
              direction: "debit",
              amountMajor: 6.6,
              currency: "EUR",
              originalAmountMajor: 248,
              originalCurrency: "THB",
              occurredAt: "2026-07-23T16:46",
              failed: false,
            },
          ],
        },
      },
      [],
      { preferBankApp: true },
    );
    expect(resolved.kind).toBe("bank_app");
    expect(resolved.alreadyKnown).toBe(false);
    expect(resolved.suggestedAmountMinor).toBe(24_800);
    expect(resolved.selectedBatch.length).toBe(1);
  });
});

describe("false already-known regression", () => {
  it("pending fingerprints must not mark SMS as all_known — only confirmed", () => {
    // Simulate: resolve only receives confirmed fps. A fingerprint that only
    // existed as abandoned needs_review is absent → import stays ready.
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          detectedKind: "bangkok_bank_sms",
          fullText:
            "Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,028.04.",
          smsTexts: [
            "Withdrawal from your account X6591 of Bt 50.00 via MOBILE; the available balance is Bt 12,028.04.",
          ],
        },
      },
      [], // confirmed-only set is empty even if UI had abandoned review
    );
    expect(resolved.kind).toBe("bank_sms");
    expect(resolved.alreadyKnown).toBe(false);
    expect(resolved.selectedBatch.length).toBe(1);
  });
});
