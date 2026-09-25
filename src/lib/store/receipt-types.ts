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
  /** AI-suggested category (one of the app's known categories) when confidently read from the screenshot. */
  categoryHint: string | null;
  occurredAt?: string | null;
};

export type CaptureAccountOption = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  lastUsedAt: string | null;
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
  /** Vision confidence 0–1 when available. */
  confidence: number | null;
  message: string | null;
  importKind: "bank_sms" | "bank_app" | "receipt" | "unknown";
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  alreadyKnown: boolean;
  skippedOlderCount: number;
  direction: "debit" | "credit" | null;
  /** Active and archived accounts the review can choose from. */
  accounts?: CaptureAccountOption[];
  /** Hint for a receipt that has no event rows. */
  categoryHint?: string | null;
  /** Name used if Bekräfta has to open a new account (Bankapp, bunq, Revolut). */
  newAccountName?: string | null;
};

export type ConfirmReceiptInput = {
  accountId?: string | null;
  observationId: string;
  candidateId?: string | null;
  /** Confirm every pending candidate on this observation (multi-SMS). */
  confirmAllPending?: boolean;
  /** Required for receipt_camera; ignored for SMS batch (amounts come from candidates). */
  amountMinor?: number;
  description?: string;
  category?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
  source?: "receipt_camera" | "screenshot" | "bank_import";
  maskedAccount?: string | null;
  direction?: "debit" | "credit" | null;
  clientMutationId?: string | null;
  /** YYYY-MM-DD from the review. Null keeps each row's own timestamp. */
  occurredOn?: string | null;
};
