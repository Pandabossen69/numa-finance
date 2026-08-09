import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  PlanItem,
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
  /** Remaining reserved after matching this period's expenses. */
  reservedMinor: number;
  /** Original reserved plan total before spending allocation. */
  reservedPlannedMinor: number;
  bufferMinor: number;
  /** Remaining flexible after matched spend. */
  flexibleMinor: number;
  flexiblePlannedMinor: number;
  daysUntilIncome: number;
  recentTransactions: CanonicalTransaction[];
  planItems: PlanItem[];
  /** Remaining vs planned per plan item (for Plan UI). */
  planItemRemaining: Array<{
    itemId: string;
    plannedMinor: number;
    remainingMinor: number;
    spentMinor: number;
  }>;
  currency: CurrencyCode;
  /** Personal game progress — never includes balances. */
  progress: UserProgress | null;
};
