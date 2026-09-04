import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import type { CurrencyCode } from "@/domain/money";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";
import { getTodaySnapshot } from "@/lib/store/repository";
import { homeSnapshotFromToday } from "./snapshot-from-today";

export type HomeSnapshot = {
  userId: string;
  displayName: string;
  timeZone: string;
  primaryAccountId: string | null;
  currency: CurrencyCode;
  monthKey: string;
  monthLabelSv: string;
  hasBankTruth: boolean;
  calculatedBalanceMinor: number | null;
  verificationLabel: string | null;
  todaySpendingMinor: number;
  todayPlannedPaidMinor: number;
  monthSpendingMinor: number;
  cycleSpendingMinor: number;
  safeToSpendTodayMinor: number;
  cycleStartLabelSv: string | null;
  cycleEndLabelSv: string | null;
  cycleEndInferred: boolean;
  cycleIsActive: boolean;
  /** bridge = tills nästa intäkt (saldo), cycle = efter lön (plan), empty = saknar intäkter */
  livingMode: "bridge" | "cycle" | "empty";
  needsAvailableInput: boolean;
  usesBankBalance: boolean;
  planIncomeMinor: number;
  planExpenseMinor: number;
  planSavingsMinor: number;
  /** Plan free before actual cycle spending (cycle mode reference). */
  freeToSpendMinor: number;
  /** What you have left to live on right now. */
  remainingFreeMinor: number;
  spendDaysLeft: number;
  /** Morning sticky dagsbudget — does not fall when you spend today. */
  dayBudgetMinor: number;
  /** Signed leftover of today's sticky dagsbudget (negative = overspent). */
  remainingTodayMinor: number;
  daysUntilIncome: number;
  nextIncomeLabelSv: string | null;
  extraSaldoMinor: number;
  extraSaldoDrawnMinor: number;
  extraSaldoHint: string | null;
  extraCarriedInMinor: number;
  savingsTotalMinor: number;
  wealthTotalMinor: number;
  monthResultMinor: number;
  /** Remaining planned income not yet in the ledger. */
  incomingMinor: number;
  /** Remaining planned expenses not yet in the ledger (not savings). */
  unpaidMinor: number;
  /** Saldo + kommer in − kvar att betala. */
  overMinor: number;
  financeRevision: string;
  verifiedAt: string;
  /** verified = authoritative read; stale/unavailable kept for client fail-soft */
  truthStatus: "verified" | "stale" | "unavailable";
};

export type HomeSnapshotResult =
  { ok: true; data: HomeSnapshot } | { ok: false; error: string };

/**
 * Request-scoped snapshot for Hem / Plan / Analys.
 * Rörelser loads its own ledger so a cold menu tap is not a full Hem fetch.
 * Cross-request `unstable_cache` cannot wrap the RLS client (cookies()).
 * Layout + loaders share this via React `cache()` so navigation does not
 * repeat the same numa reads inside one render.
 */
export const getCachedTodaySnapshot = cache(getTodaySnapshot);

export async function loadHomeSnapshot(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    return { ok: true, data: homeSnapshotFromToday(snap) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[numa] loadHomeSnapshot failed", error);
    void reportError("loader.home", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte hämta din ekonomi"),
    };
  }
}
