import type {
  ExtractedTransactionCandidate,
  SourceObservation,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export type ReceiptUploadResult = {
  observation: SourceObservation;
  candidate: ExtractedTransactionCandidate | null;
  suggestedAmountMinor: number | null;
  suggestedDescription: string | null;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed";
  message: string | null;
};

export type ConfirmReceiptInput = {
  accountId: string;
  observationId: string;
  candidateId?: string | null;
  amountMinor: number;
  description?: string;
  category?: string | null;
};
