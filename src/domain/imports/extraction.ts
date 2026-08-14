/**
 * Extraction pipeline abstraction — Phase 0 stubs.
 * AI/OCR must never write canonical transactions directly.
 */

import type { CurrencyCode } from "@/domain/money";

export type ExtractionProviderName = "none" | "manual_stub" | "vision_api";

export type ExtractionRequest = {
  observationId: string;
  storagePath: string;
  /** Server-side image bytes for vision providers (never sent to the ledger). */
  imageBase64?: string;
  mimeType?: string;
  institutionHint?: string | null;
};

export type ExtractionProviderResult = {
  provider: ExtractionProviderName;
  candidates: Array<{
    direction: "debit" | "credit" | null;
    amountMinor: number | null;
    currency: CurrencyCode | null;
    balanceAfterMinor: number | null;
    occurredAt: string | null;
    description: string | null;
    confidence: number | null;
    rawPayload: Record<string, unknown>;
  }>;
  rawMetadata: Record<string, unknown>;
};

export interface ExtractionProvider {
  readonly name: ExtractionProviderName;
  extract(request: ExtractionRequest): Promise<ExtractionProviderResult>;
}

/**
 * Explicit non-implementation so UI never claims OCR works.
 */
export class UnconfiguredExtractionProvider implements ExtractionProvider {
  readonly name = "none" as const;

  async extract(_request: ExtractionRequest): Promise<ExtractionProviderResult> {
    void _request;
    return {
      provider: "none",
      candidates: [],
      rawMetadata: {
        message:
          "OCR/vision is not configured. Upload is stored as an observation only.",
      },
    };
  }
}
