import { describe, expect, it } from "vitest";
import type { ExtractionProviderResult } from "./extraction";
import { resolveScreenshotImport } from "./resolve-screenshot-import";
import { uploadLimitFlags } from "./upload-rate-limit";
import {
  amountAppearsInText,
  COULD_NOT_READ_SV,
  groundVisionExtraction,
  labelAppears,
} from "./vision-grounding";

const NOW = new Date("2026-09-28T12:00:00.000Z");

function candidate(input: {
  amountMinor: number;
  description: string;
  occurredAt?: string | null;
}): ExtractionProviderResult["candidates"][number] {
  return {
    direction: "debit",
    amountMinor: input.amountMinor,
    currency: "THB",
    balanceAfterMinor: null,
    occurredAt: input.occurredAt ?? "2026-09-25T04:02:00.000Z",
    description: input.description,
    confidence: 0.9,
    rawPayload: { merchant: input.description },
  };
}

function bankRead(input: {
  fullText: string;
  rows: Array<{
    merchant: string;
    amountMajor: number;
    occurredAt?: string;
  }>;
}): ExtractionProviderResult {
  return {
    provider: "vision_api",
    candidates: input.rows.map((row) =>
      candidate({
        amountMinor: Math.round(row.amountMajor * 100),
        description: row.merchant,
        occurredAt: row.occurredAt ?? "2026-09-25T04:02:00.000Z",
      }),
    ),
    rawMetadata: {
      detectedKind: input.rows.length > 1 ? "bank_app_list" : "bank_app_detail",
      fullText: input.fullText,
      modelFullText: input.fullText,
      transactions: input.rows.map((row) => ({
        merchant: row.merchant,
        direction: "debit",
        amountMajor: row.amountMajor,
        currency: "THB",
        occurredAt: row.occurredAt ?? "2026-09-25T11:02",
      })),
    },
  };
}

describe("vision grounding", () => {
  it("matches amounts across separators and keeps Thai and mixed-case stores", () => {
    expect(amountAppearsInText(6_300, "−63,00 THB")).toBe(true);
    expect(amountAppearsInText(6_400, "64.00 บาท")).toBe(true);
    expect(amountAppearsInText(6_300, "630,00 THB")).toBe(false);
    expect(amountAppearsInText(15_000, "1500,00 THB")).toBe(false);
    expect(amountAppearsInText(150_000, "1 500,00 THB")).toBe(true);
    expect(labelAppears("7-Eleven Z4C QA", "7 Eleven Z4C QA")).toBe(true);
    expect(labelAppears("Starbucks", "STARBUCKS coffee")).toBe(true);
    expect(labelAppears("ร้านกาแฟ", "ร้านกาแฟ\n63,00 บาท")).toBe(true);
    expect(labelAppears("Amazon", "Amazonas")).toBe(false);
  });

  it("keeps a z4c and z4e receipt when the store and amount are in the text", () => {
    for (const [store, amount, printed] of [
      ["7-Eleven Z4C QA", 63, "63,00"],
      ["Grab Z4E QA", 64, "64,00"],
    ] as const) {
      const fullText = `${store}\n${printed} THB`;
      const grounded = groundVisionExtraction(
        {
          provider: "vision_api",
          candidates: [
            candidate({ amountMinor: amount * 100, description: store }),
          ],
          rawMetadata: {
            detectedKind: "receipt",
            fullText,
            modelFullText: fullText,
          },
        },
        NOW,
      );
      expect(grounded.rawMetadata.groundingRejected).toBeUndefined();
      expect(grounded.candidates[0]?.amountMinor).toBe(amount * 100);
      expect(grounded.candidates[0]?.description).toBe(store);
    }
  });

  it("keeps a bank-app list when every row is in the transcript", () => {
    const fullText = [
      "7-Eleven Z4C QA",
      "−63,00 THB",
      "Grab Z4E QA",
      "64.00 THB",
    ].join("\n");
    const grounded = groundVisionExtraction(
      bankRead({
        fullText,
        rows: [
          { merchant: "7-Eleven Z4C QA", amountMajor: 63 },
          { merchant: "Grab Z4E QA", amountMajor: 64 },
        ],
      }),
      NOW,
    );
    expect(grounded.rawMetadata.groundingRejected).toBeUndefined();
    expect(grounded.rawMetadata.detectedKind).toBe("bank_app_list");
    const transactions = grounded.rawMetadata.transactions as unknown[];
    expect(transactions).toHaveLength(2);
    const resolved = resolveScreenshotImport(grounded, [], { preferBankApp: true });
    expect(resolved.kind).toBe("bank_app");
    expect(resolved.selectedBatch.map((row) => row.amountMinor).sort()).toEqual([
      6_300, 6_400,
    ]);
  });

  it("rejects an empty image and does not spend the hourly upload", () => {
    const grounded = groundVisionExtraction(
      bankRead({
        fullText: "",
        rows: [
          { merchant: "7-Eleven", amountMajor: 248, occurredAt: "2023-10-01" },
          { merchant: "Starbucks", amountMajor: 150, occurredAt: "2023-10-02" },
          { merchant: "Amazon", amountMajor: 500, occurredAt: "2023-10-03" },
        ],
      }),
      NOW,
    );
    expect(grounded.rawMetadata.detectedKind).toBe("unknown");
    expect(grounded.rawMetadata.groundingReason).toBe("fulltext_empty");
    expect(grounded.rawMetadata.groundingRejected).toBe(true);
    expect(grounded.candidates).toEqual([]);
    expect(grounded.rawMetadata.transactions).toEqual([]);
    expect(grounded.rawMetadata.message).toBe(COULD_NOT_READ_SV);
    expect(
      uploadLimitFlags({
        provider: grounded.provider,
        amountMinors: grounded.candidates.map((row) => row.amountMinor),
        alreadyKnown: false,
        detectedKind: String(grounded.rawMetadata.detectedKind),
        groundingRejected: true,
      }),
    ).toEqual({ ocrFailed: true, countsTowardUploadLimit: false });
    const resolved = resolveScreenshotImport(grounded, [], { preferBankApp: true });
    expect(resolved.suggestedAmountMinor).toBeNull();
    expect(resolved.selectedBatch).toEqual([]);
    expect(resolved.messageSv).toContain("Kunde inte läsa");
    expect(resolved.messageSv).toContain("Manuellt");
  });

  it("rejects a transcript with no amount", () => {
    const grounded = groundVisionExtraction(
      {
        provider: "vision_api",
        candidates: [candidate({ amountMinor: 6_300, description: "7-Eleven Z4C QA" })],
        rawMetadata: {
          detectedKind: "receipt",
          fullText: "Order 2026 utan belopp",
          modelFullText: "Order 2026 utan belopp",
        },
      },
      NOW,
    );
    expect(grounded.rawMetadata.groundingReason).toBe("fulltext_no_amount");
    expect(grounded.candidates).toEqual([]);
  });

  it("rejects 7-Eleven, Starbucks and Amazon when they are not in the transcript", () => {
    const grounded = groundVisionExtraction(
      bankRead({
        fullText: "Annan butik\n12,00 THB",
        rows: [
          { merchant: "7-Eleven", amountMajor: 248, occurredAt: "2023-10-01" },
          { merchant: "Starbucks", amountMajor: 150, occurredAt: "2023-10-02" },
          { merchant: "Amazon", amountMajor: 500, occurredAt: "2023-10-03" },
        ],
      }),
      NOW,
    );
    expect(grounded.rawMetadata.groundingReason).toBe("candidates_not_in_text");
    expect(grounded.rawMetadata.detectedKind).toBe("unknown");
    expect(grounded.candidates).toEqual([]);
    const dropped = grounded.rawMetadata.groundingDropped as Array<{ merchant: string }>;
    expect(dropped.map((row) => row.merchant)).toEqual([
      "7-Eleven",
      "Starbucks",
      "Amazon",
    ]);
    const resolved = resolveScreenshotImport(grounded, [], { preferBankApp: true });
    expect(resolved.selectedBatch).toEqual([]);
    expect(resolved.messageSv).toBe(COULD_NOT_READ_SV);
  });

  it("moves a grounded date more than a year away to today", () => {
    const fullText = "7-Eleven Z4C QA\n63,00 THB";
    const grounded = groundVisionExtraction(
      bankRead({
        fullText,
        rows: [
          {
            merchant: "7-Eleven Z4C QA",
            amountMajor: 63,
            occurredAt: "2023-10-01",
          },
        ],
      }),
      NOW,
    );
    expect(grounded.rawMetadata.groundingRejected).toBeUndefined();
    expect(grounded.rawMetadata.dateUncertain).toBe(true);
    const transactions = grounded.rawMetadata.transactions as Array<{ occurredAt: string }>;
    expect(transactions[0]?.occurredAt).toBe(NOW.toISOString());
    const resolved = resolveScreenshotImport(grounded, [], { preferBankApp: true });
    expect(resolved.kind).toBe("bank_app");
    if (resolved.kind !== "bank_app") return;
    expect(resolved.selectedBatch[0]?.occurredAt.startsWith("2023")).toBe(false);
    expect(resolved.selectedBatch[0]?.occurredAt.slice(0, 4)).toBe("2026");
  });
});
