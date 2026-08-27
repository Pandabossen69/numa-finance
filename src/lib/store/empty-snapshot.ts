import type { Account, PlanItem, Profile } from "@/domain/finance";
import { emptyUserProgress, type UserProgress } from "./types-progress";
import type { TodaySnapshot } from "./types-snapshot";

/**
 * Shape a brand-new NUMA user sees: no accounts, no plan, no ledger.
 * Mot planen / Över / Saldo stay empty/zero until they fill their own data.
 */
export function emptyTodaySnapshot(
  profile: Profile,
  accounts: Account[] = [],
  progress: UserProgress | null = null,
  planItems: PlanItem[] = [],
): TodaySnapshot {
  return {
    profile,
    accounts,
    primaryAccount: null,
    checkpoint: null,
    calculatedBalanceMinor: null,
    balanceKind: "unknown",
    verificationLabel: null,
    todaySpendingMinor: 0,
    monthSpendingMinor: 0,
    cycleSpendingMinor: 0,
    monthSpendingByKey: {},
    fundingConfirmed: false,
    safeToSpendTodayMinor: 0,
    safeToSpendWeekMinor: 0,
    freeMinor: 0,
    reservedMinor: 0,
    bufferMinor: 0,
    flexibleMinor: 0,
    daysUntilIncome: 0,
    recentTransactions: [],
    ledgerTransactions: [],
    planItems,
    currency: profile.primaryCurrency,
    progress: progress ?? emptyUserProgress(profile.id),
  };
}
