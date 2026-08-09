import type { CurrencyCode } from "@/domain/money";

export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit"
  | "investment"
  | "other";

export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "cash_withdrawal"
  | "refund"
  | "adjustment"
  | "unknown";

export type TransactionDirection = "debit" | "credit";

export type TransactionSource =
  | "manual"
  | "receipt_camera"
  | "price_camera"
  | "screenshot"
  | "sms"
  | "bank_import"
  | "api"
  | "adjustment";

export type TransactionStatus =
  | "pending_sync"
  | "confirmed"
  | "needs_review"
  | "voided";

export type ObservationStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "needs_review"
  | "processed"
  | "failed";

export type CandidateStatus =
  | "pending"
  | "validated"
  | "duplicate"
  | "needs_review"
  | "confirmed"
  | "rejected";

export type ReconciliationState =
  | "reconciled"
  | "calculated_since_verification"
  | "needs_review"
  | "discrepancy"
  | "stale_verification";

export type PlanCategoryKind =
  | "mandatory"
  | "expected"
  | "flexible"
  | "goal"
  | "buffer";

export type SyncStatus = "saved" | "pending_sync" | "synced" | "failed";

export type Profile = {
  id: string;
  displayName: string;
  timezone: string;
  primaryCurrency: CurrencyCode;
  referenceCurrency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
};

export type Account = {
  id: string;
  userId: string;
  name: string;
  institution: string | null;
  accountType: AccountType;
  currency: CurrencyCode;
  maskedIdentifier: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BalanceCheckpoint = {
  id: string;
  userId: string;
  accountId: string;
  balanceMinor: number;
  currency: CurrencyCode;
  verifiedAt: string;
  source: string;
  sourceObservationId: string | null;
  note: string | null;
  createdAt: string;
};

export type CanonicalTransaction = {
  id: string;
  userId: string;
  accountId: string;
  counterAccountId: string | null;
  direction: TransactionDirection;
  transactionType: TransactionType;
  amountMinor: number;
  currency: CurrencyCode;
  occurredAt: string;
  description: string;
  merchant: string | null;
  category: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  balanceAfterMinor: number | null;
  fingerprint: string | null;
  sourceObservationId: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type SourceObservation = {
  id: string;
  userId: string;
  kind: "screenshot" | "receipt" | "price" | "sms" | "other";
  storagePath: string | null;
  institutionHint: string | null;
  accountHint: string | null;
  status: ObservationStatus;
  capturedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionRun = {
  id: string;
  observationId: string;
  userId: string;
  provider: string;
  status: "pending" | "succeeded" | "failed";
  rawMetadata: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
};

export type ExtractedTransactionCandidate = {
  id: string;
  extractionRunId: string;
  observationId: string;
  userId: string;
  direction: TransactionDirection | null;
  amountMinor: number | null;
  currency: CurrencyCode | null;
  balanceAfterMinor: number | null;
  occurredAt: string | null;
  description: string | null;
  confidence: number | null;
  fingerprint: string | null;
  status: CandidateStatus;
  canonicalTransactionId: string | null;
  rawPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ReconciliationIssue = {
  id: string;
  userId: string;
  accountId: string;
  expectedBalanceMinor: number;
  observedBalanceMinor: number;
  differenceMinor: number;
  currency: CurrencyCode;
  state: ReconciliationState;
  message: string;
  resolvedAt: string | null;
  createdAt: string;
};
