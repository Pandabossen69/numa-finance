import type {
  ExtractedTransactionCandidate,
  SourceObservation,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export type ReceiptUploadEvent = {
  candidateId: string;
  direction: "debit" | "credit";
  amountMinor: number;
  balanceAfterMinor: number | null;
  fingerprint: string;
  description: string;
  labelSv: string;
};

export type ReceiptUploadResult = {
  observation: SourceObservation;
  candidate: ExtractedTransactionCandidate | null;
  /** Unknown events from this screenshot (bank_sms / bank_app). */
  events: ReceiptUploadEvent[];
  suggestedAmountMinor: number | null;
  suggestedDescription: string | null;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed" | "all_known";
  message: string | null;
  importKind: "bank_sms" | "bank_app" | "receipt" | "unknown";
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  alreadyKnown: boolean;
  skippedOlderCount: number;
  direction: "debit" | "credit" | null;
};

export type ConfirmReceiptInput = {
  accountId?: string | null;
  observationId: string;
  candidateId?: string | null;
  /** Confirm every pending candidate on this observation (multi-SMS). */
  confirmAllPending?: boolean;
  amountMinor: number;
  description?: string;
  category?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  source?: "receipt_camera" | "screenshot" | "bank_import";
  maskedAccount?: string | null;
  direction?: "debit" | "credit" | null;
};
