import type { BankSmsCandidate } from "@/domain/imports";
import type { SourceObservation } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

export type BankSmsUploadResult = {
  observation: SourceObservation;
  candidates: BankSmsCandidate[];
  latestBalanceAfterMinor: number | null;
  currency: CurrencyCode;
  ocrStatus: "ok" | "unavailable" | "failed" | "pasted";
  message: string | null;
  extractedText: string | null;
};

export type ConfirmBankSmsItem = {
  fingerprint: string;
  direction: "debit" | "credit";
  amountMinor: number;
  balanceAfterMinor: number | null;
  description: string;
  /** When true, skip even if not marked duplicate. */
  skip?: boolean;
};

export type ConfirmBankSmsInput = {
  accountId: string;
  observationId: string;
  items: ConfirmBankSmsItem[];
  /** When true (default), write a balance checkpoint from newest balance-after. */
  updateCheckpoint?: boolean;
};

export type ConfirmBankSmsResult = {
  createdCount: number;
  skippedDuplicateCount: number;
  checkpointBalanceMinor: number | null;
};
