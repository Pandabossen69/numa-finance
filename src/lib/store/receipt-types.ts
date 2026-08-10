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
  ocrStatus: "ok" | "unavailable" | "failed" | "all_known";
  message: string | null;
  importKind: "bank_sms" | "receipt" | "unknown";
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  alreadyKnown: boolean;
  skippedOlderCount: number;
};

export type ConfirmReceiptInput = {
  accountId?: string | null;
  observationId: string;
  candidateId?: string | null;
  amountMinor: number;
  description?: string;
  category?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  source?: "receipt_camera" | "screenshot";
  maskedAccount?: string | null;
};
