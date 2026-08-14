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
import { planBankAppLedger } from "./bank-app-ledger";
import {
  findOcrFxRate,
  parseOcrFxQuotes,
} from "./fx-ocr";
import { buildBankAppFingerprint } from "@/domain/finance/fingerprint";
import { sanitizeBankSmsText, BangkokBankSmsParser } from "./bank-parsers";
import { resolveScreenshotImport } from "./resolve-screenshot-import";
import { formatMoney, money } from "@/domain/money";

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

  it("sanitizes OCR digit noise only in number tokens", () => {
    expect(sanitizeOcrDigitNoise("1O.5")).toBe("10.5");
    expect(westernAmountToMinor("1O,758.04")).toBe(1_075_804);
  });
});

describe("EUR currency formatting", () => {
  it("formats euro with € symbol", () => {
    const shown = formatMoney(money(660, "EUR")).replace(/\u00a0/g, " ");
    expect(shown).toContain("6,60");
    expect(shown).toContain("€");
  });
});

describe("fx-ocr", () => {
  it("parses bunq ZeroFX quote and can convert EUR→THB", () => {
    const text = "248.00 THB, 1 THB = 0.02661 EUR";
    const quotes = parseOcrFxQuotes(text, {
      asOf: "2026-07-23T16:46:00.000Z",
    });
    expect(quotes.length).toBeGreaterThanOrEqual(1);
    const rate = findOcrFxRate(text, "EUR", "THB", {
      asOf: "2026-07-23T16:46:00.000Z",
    });
    expect(rate).not.toBeNull();
    expect(rate!.baseCurrency).toBe("EUR");
    expect(rate!.quoteCurrency).toBe("THB");
    // 1/0.02661 ≈ 37.58 THB per EUR
    expect(rate!.rate).toBeCloseTo(1 / 0.02661, 4);
  });
});

describe("bank-app ledger policy", () => {
  it("posts Grab in EUR (card currency), annotates THB", () => {
    const plan = planBankAppLedger({
      institution: "bunq",
      merchant: "Grab",
      direction: "debit",
      displayAmountMinor: 660,
      displayCurrency: "EUR",
      originalAmountMinor: 24_800,
      originalCurrency: "THB",
      rawText: "248.00 THB, 1 THB = 0.02661 EUR",
    });
    expect(plan.mode).toBe("native");
    if (plan.mode !== "native") return;
    expect(plan.amountMinor).toBe(660);
    expect(plan.currency).toBe("EUR");
    expect(plan.accountName).toBe("bunq");
    expect(plan.annotationSv).toMatch(/248/);
  });

  it("supports pure EUR list rows", () => {
    const plan = planBankAppLedger({
      institution: "bunq",
      merchant: "Grab",
      direction: "debit",
      displayAmountMinor: 930,
      displayCurrency: "EUR",
      originalAmountMinor: null,
      originalCurrency: null,
    });
    expect(plan.mode).toBe("native");
    if (plan.mode !== "native") return;
    expect(plan.amountMinor).toBe(930);
    expect(plan.currency).toBe("EUR");
  });

  it("can FX-convert to THB when preferFxToPrimary + OCR rate", () => {
    const plan = planBankAppLedger({
      institution: "bunq",
      merchant: "Grab",
      direction: "debit",
      displayAmountMinor: 660,
      displayCurrency: "EUR",
      originalAmountMinor: null,
      originalCurrency: null,
      rawText: "1 EUR = 37.58 THB",
      preferFxToPrimary: true,
      primaryCurrency: "THB",
      occurredAt: "2026-07-23T16:46",
    });
    expect(plan.mode).toBe("fx_to_primary");
    if (plan.mode !== "fx_to_primary") return;
    expect(plan.currency).toBe("THB");
    expect(plan.fx.originalCurrency).toBe("EUR");
    expect(plan.amountMinor).toBe(Math.round(6.6 * 37.58 * 100));
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

  it("uses EUR card amount and stable fingerprints across detail/list", () => {
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
    expect(rows[0]?.amountMinor).toBe(660);
    expect(rows[0]?.currency).toBe("EUR");
    expect(rows[0]?.annotationSv).toMatch(/248/);

    const detailFp = buildBankAppFingerprint({
      institution: "bunq",
      merchant: "Grab",
      direction: "debit",
      amountMinor: 660,
      currency: "EUR",
      occurredAt: "2026-07-23T16:46:00",
      originalAmountMinor: 24_800,
      originalCurrency: "THB",
    });
    const listFp = buildBankAppFingerprint({
      institution: "bunq",
      merchant: "WWW.GRAB.COM",
      direction: "debit",
      amountMinor: 660,
      currency: "EUR",
      occurredAt: "2026-07-23T16:46",
    });
    expect(detailFp.fingerprint).toBe(listFp.fingerprint);
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
    expect(result.selectedBatch[0]?.currency).toBe("EUR");
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

  it("parses bunq detail text heuristic as EUR with THB annotation", () => {
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
    expect(parsed[0]?.amountMinor).toBe(660);
    expect(parsed[0]?.currency).toBe("EUR");
    expect(parsed[0]?.merchant.toLowerCase()).toContain("grab");
  });

  it("resolveScreenshotImport routes pure EUR bank_app rows", () => {
    const resolved = resolveScreenshotImport(
      {
        provider: "vision_api",
        candidates: [
          {
            direction: "debit",
            amountMinor: 930,
            currency: "EUR",
            balanceAfterMinor: null,
            occurredAt: "2026-07-23T16:46",
            description: "Grab",
            confidence: 0.9,
            rawPayload: {
              merchant: "Grab",
              occurredAt: "2026-07-23T16:46",
            },
          },
        ],
        rawMetadata: {
          detectedKind: "bank_app_list",
          institutionHint: "bunq",
          fullText: "Grab onlinebetalning -9,30 €",
          transactions: [
            {
              merchant: "Grab",
              direction: "debit",
              amountMajor: 9.3,
              currency: "EUR",
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
    expect(resolved.currency).toBe("EUR");
    expect(resolved.suggestedAmountMinor).toBe(930);
    expect(resolved.selectedBatch.length).toBe(1);
  });
});

describe("false already-known regression", () => {
  it("pending fingerprints must not mark SMS as all_known — only confirmed", () => {
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
      [],
    );
    expect(resolved.kind).toBe("bank_sms");
    expect(resolved.alreadyKnown).toBe(false);
    expect(resolved.selectedBatch.length).toBe(1);
  });
});
