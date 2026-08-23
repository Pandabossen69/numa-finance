import { describe, expect, it } from "vitest";
import type { ExtractedTransactionCandidate } from "@/domain/finance";
import { buildCapturePreview } from "./capture-preview";
import { CAPTURE_UI_COPY } from "./capture-ui-copy";
import {
  fotaHrefForObservation,
  isObservationId,
  modeForObservation,
  parseFotaMode,
} from "./capture-resume";

const SMS_ID = "11111111-1111-4111-8111-111111111111";
const RECEIPT_ID = "22222222-2222-4222-8222-222222222222";
const BUNQ_ID = "33333333-3333-4333-8333-333333333333";

function candidate(
  overrides: Partial<ExtractedTransactionCandidate> & { id: string },
): ExtractedTransactionCandidate {
  return {
    extractionRunId: "run-1",
    observationId: SMS_ID,
    userId: "user-1",
    direction: "debit",
    amountMinor: 12500,
    currency: "THB",
    balanceAfterMinor: 80000,
    occurredAt: null,
    description: "7-Eleven",
    confidence: 0.9,
    fingerprint: "sms|7eleven|12500",
    status: "needs_review",
    canonicalTransactionId: null,
    rawPayload: { labelSv: "Utgift · 7-Eleven", batchIndex: 0 },
    createdAt: "2026-08-23T10:00:00.000Z",
    updatedAt: "2026-08-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("fota resume routing", () => {
  it("maps receipt / SMS / bank-app observations to the matching mode", () => {
    expect(modeForObservation({ kind: "receipt" })).toBe("receipt");
    expect(modeForObservation({ kind: "screenshot" })).toBe("bank_sms");
    expect(modeForObservation({ kind: "sms" })).toBe("bank_sms");
    expect(
      modeForObservation({ kind: "screenshot", institutionHint: "bunq" }),
    ).toBe("bank_app");
    expect(
      modeForObservation({ kind: "screenshot", institutionHint: "Revolut" }),
    ).toBe("bank_app");
    expect(
      modeForObservation({ kind: "screenshot", institutionHint: "bank_app" }),
    ).toBe("bank_app");
  });

  it("Fortsätt keeps observation id; Fota igen only keeps mode", () => {
    expect(
      fotaHrefForObservation({
        id: SMS_ID,
        kind: "screenshot",
        status: "needs_review",
        institutionHint: "Bangkok Bank",
      }),
    ).toBe(`/fota?mode=bank_sms&observation=${SMS_ID}`);

    expect(
      fotaHrefForObservation({
        id: RECEIPT_ID,
        kind: "receipt",
        status: "needs_review",
      }),
    ).toBe(`/fota?mode=receipt&observation=${RECEIPT_ID}`);

    expect(
      fotaHrefForObservation({
        id: BUNQ_ID,
        kind: "screenshot",
        status: "needs_review",
        institutionHint: "bunq",
      }),
    ).toBe(`/fota?mode=bank_app&observation=${BUNQ_ID}`);

    expect(
      fotaHrefForObservation({
        id: SMS_ID,
        kind: "screenshot",
        status: "failed",
      }),
    ).toBe("/fota?mode=bank_sms");

    expect(
      fotaHrefForObservation({
        id: RECEIPT_ID,
        kind: "receipt",
        status: "failed",
      }),
    ).toBe("/fota?mode=receipt");
  });

  it("never returns bare /fota for a typed observation", () => {
    expect(
      fotaHrefForObservation({
        id: SMS_ID,
        kind: "screenshot",
        status: "needs_review",
      }),
    ).not.toBe("/fota");
  });

  it("parses fota mode aliases", () => {
    expect(parseFotaMode("kvitto")).toBe("receipt");
    expect(parseFotaMode("sms")).toBe("bank_sms");
    expect(parseFotaMode("revolut")).toBe("bank_app");
    expect(parseFotaMode(undefined)).toBe("pick");
    expect(isObservationId(SMS_ID)).toBe(true);
    expect(isObservationId("not-a-uuid")).toBe(false);
  });
});

describe("buildCapturePreview", () => {
  it("restores SMS events and image so confirm can continue", () => {
    const preview = buildCapturePreview({
      observation: {
        id: SMS_ID,
        kind: "screenshot",
        institutionHint: "Bangkok Bank",
        status: "needs_review",
        notes: "2 rörelser lästa",
      },
      candidates: [
        candidate({ id: "cand-1" }),
        candidate({
          id: "cand-2",
          direction: "credit",
          amountMinor: 50000,
          fingerprint: "sms|lön|50000",
          description: "Lön",
          rawPayload: { labelSv: "Insättning · Lön", batchIndex: 1 },
          balanceAfterMinor: null,
        }),
      ],
      previewUrl: "https://example.test/sms.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview).not.toBeNull();
    expect(preview?.importKind).toBe("bank_sms");
    expect(preview?.observationId).toBe(SMS_ID);
    expect(preview?.previewUrl).toBe("https://example.test/sms.jpg");
    expect(preview?.events).toHaveLength(2);
    expect(preview?.alreadyKnown).toBe(false);
    expect(preview?.balanceAfterMinor).toBe(80000);
    expect(preview?.ocrStatus).toBe("ok");
  });

  it("restores a receipt amount without SMS chrome", () => {
    const preview = buildCapturePreview({
      observation: {
        id: RECEIPT_ID,
        kind: "receipt",
        institutionHint: null,
        status: "needs_review",
        notes: "Inläst från kvittot",
      },
      candidates: [
        candidate({
          id: "cand-r",
          observationId: RECEIPT_ID,
          amountMinor: 8900,
          fingerprint: "receipt|cafe|8900",
          description: "Café",
          balanceAfterMinor: null,
        }),
      ],
      previewUrl: "https://example.test/kvitto.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview?.importKind).toBe("receipt");
    expect(preview?.amount).toBe("89,00");
    expect(preview?.amountFromScan).toBe(true);
    expect(preview?.events).toHaveLength(1);
  });

  it("prefills a receipt total even without a fingerprint", () => {
    const preview = buildCapturePreview({
      observation: {
        id: RECEIPT_ID,
        kind: "receipt",
        institutionHint: null,
        status: "needs_review",
        notes: "Totalt 249,00 inläst från kvittot",
      },
      candidates: [
        candidate({
          id: "cand-loose",
          observationId: RECEIPT_ID,
          amountMinor: 24900,
          fingerprint: null,
          description: "Kvitto",
          balanceAfterMinor: null,
        }),
      ],
      previewUrl: "https://example.test/kvitto.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview?.amount).toBe("249,00");
    expect(preview?.amountFromScan).toBe(true);
  });

  it("prefills production Fortsätt receipts whose notes have no digits", () => {
    const preview = buildCapturePreview({
      observation: {
        id: RECEIPT_ID,
        kind: "receipt",
        institutionHint: null,
        status: "needs_review",
        notes:
          "Vi läste totalsumman (det du faktiskt betalade) — dubbelkolla innan du sparar.",
      },
      candidates: [
        candidate({
          id: "cand-prod",
          observationId: RECEIPT_ID,
          amountMinor: 24500,
          fingerprint: null,
          description: "7-Eleven",
          balanceAfterMinor: null,
        }),
      ],
      previewUrl: "https://example.test/kvitto.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview?.amount).toBe("245,00");
    expect(preview?.amountFromScan).toBe(true);
    expect(preview?.candidateId).toBe("cand-prod");
    expect(preview?.description).toBe("7-Eleven");
    expect(preview?.ocrStatus).toBe("ok");
  });

  it("recovers a receipt total from vision rawPayload when amount_minor is 0", () => {
    const preview = buildCapturePreview({
      observation: {
        id: RECEIPT_ID,
        kind: "receipt",
        institutionHint: null,
        status: "needs_review",
        notes: "Belopp inläst från bilden. Dubbelkolla och spara.",
      },
      candidates: [
        candidate({
          id: "cand-payload",
          observationId: RECEIPT_ID,
          amountMinor: 0,
          fingerprint: null,
          description: "Grab",
          balanceAfterMinor: null,
          rawPayload: {
            amountMajor: 189.5,
            fullText: "Grab\nFinal total 189.50",
            suggestedAmountMinor: 18950,
          },
        }),
      ],
      previewUrl: "https://example.test/kvitto.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview?.amount).toBe("189,50");
    expect(preview?.amountFromScan).toBe(true);
  });

  it("reads a receipt total from notes when candidates have no amount", () => {
    const preview = buildCapturePreview({
      observation: {
        id: RECEIPT_ID,
        kind: "receipt",
        institutionHint: null,
        status: "needs_review",
        notes: "Belopp 189,50 läst från kvittot",
      },
      candidates: [
        candidate({
          id: "cand-empty",
          observationId: RECEIPT_ID,
          amountMinor: 0,
          fingerprint: null,
          description: "",
          balanceAfterMinor: null,
        }),
      ],
      previewUrl: "https://example.test/kvitto.jpg",
      fallbackCurrency: "THB",
    });

    expect(preview?.amount).toBe("189,50");
    expect(preview?.amountFromScan).toBe(true);
  });

  it("returns null without media so /fota still opens the right camera", () => {
    expect(
      buildCapturePreview({
        observation: {
          id: SMS_ID,
          kind: "screenshot",
          institutionHint: null,
          status: "needs_review",
          notes: null,
        },
        candidates: [candidate({ id: "cand-1" })],
        previewUrl: null,
        fallbackCurrency: "THB",
      }),
    ).toBeNull();
  });
});

describe("Kvitto capture copy", () => {
  it("is receipt-specific and does not reuse SMS camera/gallery strings", () => {
    expect(CAPTURE_UI_COPY.receipt.camera).toBe("Fota kvittot");
    expect(CAPTURE_UI_COPY.receipt.gallery).toBe("Välj foto");
    expect(CAPTURE_UI_COPY.receipt.title).toBe("Fota kvitto");
    expect(CAPTURE_UI_COPY.receipt.camera).not.toMatch(/skärmen/i);
    expect(CAPTURE_UI_COPY.receipt.gallery).not.toMatch(/skärmdump/i);
    expect(CAPTURE_UI_COPY.receipt.hint).not.toMatch(/bubblor/i);
    expect(CAPTURE_UI_COPY.receipt.camera).not.toBe(
      CAPTURE_UI_COPY.bank_sms.camera,
    );
    expect(CAPTURE_UI_COPY.receipt.gallery).not.toBe(
      CAPTURE_UI_COPY.bank_sms.gallery,
    );
  });
});
