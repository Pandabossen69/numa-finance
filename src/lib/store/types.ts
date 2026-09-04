import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  ExtractedTransactionCandidate,
  ExtractionRun,
  PlanItem,
  PlanPaymentAllocation,
  Profile,
  ReconciliationIssue,
  SourceObservation,
} from "@/domain/finance";

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
  planItems: PlanItem[];
  planAllocations: PlanPaymentAllocation[];
  mutationKeys: Array<{
    userId: string;
    mutationId: string;
    kind: string;
    result: unknown;
    createdAt: string;
  }>;
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
      onboardingSaldoAt: null,
      onboardingCompletedAt: null,
      gettingStartedCompletedAt: null,
      gettingStartedCollapsed: false,
    },
    accounts: [],
    checkpoints: [],
    transactions: [],
    observations: [],
    extractionRuns: [],
    candidates: [],
    reconciliationIssues: [],
    planItems: [],
    planAllocations: [],
    mutationKeys: [],
  };
}

/** Normalize older local JSON that predates planItems / onboarding flags. */
export function normalizeStore(data: NumaStoreData): NumaStoreData {
  return {
    ...data,
    accounts: (Array.isArray(data.accounts) ? data.accounts : []).map((account) => {
      const kind =
        account.kind ??
        (account.accountType === "cash"
          ? "cash"
          : account.currency === "THB"
            ? "thai_bank"
            : account.currency === "SEK"
              ? "swedish_bank"
              : "other");
      return { ...account, kind };
    }),
    checkpoints: (Array.isArray(data.checkpoints) ? data.checkpoints : []).map(
      (cp) => {
        const isThb = cp.currency === "THB";
        return {
          ...cp,
          thbMinor:
            cp.thbMinor ?? (isThb ? cp.balanceMinor : null),
          fxRate: cp.fxRate ?? (isThb ? 1 : null),
          fxAsOf: cp.fxAsOf ?? (isThb ? cp.verifiedAt : null),
          fxSource: cp.fxSource ?? (isThb ? "identity" : null),
        };
      },
    ),
    planItems: (Array.isArray(data.planItems) ? data.planItems : []).map((item) => ({
      ...item,
      settledAt: item.settledAt ?? null,
      settledMinor: item.settledMinor ?? null,
      remainingDueAt: item.remainingDueAt ?? null,
    })),
    transactions: (Array.isArray(data.transactions) ? data.transactions : []).map(
      (tx) => ({
        ...tx,
        planItemId: tx.planItemId ?? null,
        thbMinor: tx.thbMinor ?? (tx.currency === "THB" ? tx.amountMinor : null),
        fxRate: tx.fxRate ?? (tx.currency === "THB" ? 1 : null),
      }),
    ),
    planAllocations: Array.isArray(data.planAllocations)
      ? data.planAllocations
      : [],
    mutationKeys: Array.isArray(data.mutationKeys) ? data.mutationKeys : [],
    profile: {
      ...data.profile,
      onboardingSaldoAt: data.profile.onboardingSaldoAt ?? null,
      onboardingCompletedAt: data.profile.onboardingCompletedAt ?? null,
      gettingStartedCompletedAt: data.profile.gettingStartedCompletedAt ?? null,
      gettingStartedCollapsed: Boolean(data.profile.gettingStartedCollapsed),
    },
  };
}
