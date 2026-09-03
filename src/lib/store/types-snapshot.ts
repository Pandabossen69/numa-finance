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
  /** Calendar-month spend totals for extra saldo (Bangkok month keys). */
  monthSpendingByKey: Record<string, number>;
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
  /**
   * Ledger rows in the snapshot window — used to match plan items as
   * received/paid so Plan/Hem remaining figures are not double-counted.
   */
  ledgerTransactions: CanonicalTransaction[];
  planItems: PlanItem[];
  currency: CurrencyCode;
  /** Personal game progress — never includes balances. */
  progress: UserProgress | null;
  /**
   * Content token shared by Hem / Plan / Analys. Equal ⇒ same financial truth.
   * Built from plan + ledger + saldo so client caches can reject stale mixes.
   */
  financeRevision: string;
  /** ISO time when this snapshot was verified from authoritative reads. */
  verifiedAt: string;
};
