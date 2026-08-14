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
  /** Confirmed spending since active pay-cycle start (bounded by end). */
  cycleSpendingMinor: number;
  /**
   * True when a confirmed credit in the cycle window proves funding landed.
   * Hem stays on bank bridge until this is true.
   */
  fundingConfirmed: boolean;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  flexibleMinor: number;
  daysUntilIncome: number;
  recentTransactions: CanonicalTransaction[];
  planItems: PlanItem[];
  currency: CurrencyCode;
  /** Personal game progress — never includes balances. */
  progress: UserProgress | null;
};
