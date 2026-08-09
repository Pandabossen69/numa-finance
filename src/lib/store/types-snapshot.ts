import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  Profile,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type { UserProgress } from "./types-progress";

export type TodaySnapshot = {
  profile: Profile;
  accounts: Account[];
  primaryAccount: Account | null;
  checkpoint: BalanceCheckpoint | null;
  calculatedBalanceMinor: number | null;
  balanceKind: "verified_checkpoint_only" | "calculated" | "unknown";
  verificationLabel: string | null;
  todaySpendingMinor: number;
  monthSpendingMinor: number;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  daysUntilIncome: number;
  recentTransactions: CanonicalTransaction[];
  currency: CurrencyCode;
  /** Personal game progress — never includes balances. */
  progress: UserProgress | null;
};
