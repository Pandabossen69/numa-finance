import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  ExtractedTransactionCandidate,
  ExtractionRun,
  Profile,
  ReconciliationIssue,
  SourceObservation,
} from "@/domain/finance/types";

export type NumaStoreData = {
  version: 1;
  profile: Profile;
  accounts: Account[];
  checkpoints: BalanceCheckpoint[];
  transactions: CanonicalTransaction[];
  observations: SourceObservation[];
  extractionRuns: ExtractionRun[];
  candidates: ExtractedTransactionCandidate[];
  reconciliationIssues: ReconciliationIssue[];
};

export const LOCAL_DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function createEmptyStore(): NumaStoreData {
  const now = new Date().toISOString();
  return {
    version: 1,
    profile: {
      id: LOCAL_DEMO_USER_ID,
      displayName: "Användare",
      timezone: "Asia/Bangkok",
      primaryCurrency: "THB",
      referenceCurrency: "SEK",
      createdAt: now,
      updatedAt: now,
    },
    accounts: [],
    checkpoints: [],
    transactions: [],
    observations: [],
    extractionRuns: [],
    candidates: [],
    reconciliationIssues: [],
  };
}
