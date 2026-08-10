import { cache } from "react";
import { NEXT_INCOME_NAME } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  primaryAccountId: string | null;
  currency: CurrencyCode;
  /** True once first bank-SMS balance has been confirmed. */
  hasBankTruth: boolean;
  calculatedBalanceMinor: number | null;
  verificationLabel: string | null;
  checkpointVerifiedAt: string | null;
  todaySpendingMinor: number;
  /** Morning day-plan for plus/minus pulse (before today's activity). */
  dayPlanMinor: number;
  safeToSpendTodayMinor: number;
  safeToSpendWeekMinor: number;
  freeMinor: number;
  reservedMinor: number;
  bufferMinor: number;
  daysUntilIncome: number;
  goals: Array<{
    id: string;
    name: string;
    amountMinor: number;
    currency: CurrencyCode;
  }>;
  recent: Array<{
    id: string;
    description: string;
    category: string | null;
    transactionType: string;
    direction: "debit" | "credit";
    amountMinor: number;
    currency: CurrencyCode;
  }>;
};

export type HomeSnapshotResult =
  | { ok: true; data: HomeSnapshot }
  | { ok: false; error: string };

/** Per-request memo — parallel RSC trees share one snapshot fetch. */
export const getCachedTodaySnapshot = cache(getTodaySnapshot);

export async function loadHomeSnapshot(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    const goals = (snap.planItems ?? [])
      .filter(
        (p) => p.isActive && p.kind === "goal" && p.name !== NEXT_INCOME_NAME,
      )
      .map((g) => ({
        id: g.id,
        name: g.name,
        amountMinor: g.amountMinor,
        currency: g.currency,
      }));

    const recent = (snap.recentTransactions ?? []).slice(0, 6).map((tx) => ({
      id: tx.id,
      description: tx.description,
      category: tx.category,
      transactionType: tx.transactionType,
      direction: tx.direction,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
    }));

    return {
      ok: true,
      data: {
        primaryAccountId: snap.primaryAccount?.id ?? null,
        currency: snap.currency,
        hasBankTruth: snap.checkpoint != null,
        calculatedBalanceMinor: snap.calculatedBalanceMinor,
        verificationLabel: snap.verificationLabel,
        checkpointVerifiedAt: snap.checkpoint?.verifiedAt ?? null,
        todaySpendingMinor: snap.todaySpendingMinor,
        dayPlanMinor: snap.dayPlanMinor,
        safeToSpendTodayMinor: snap.safeToSpendTodayMinor,
        safeToSpendWeekMinor: snap.safeToSpendWeekMinor,
        freeMinor: snap.freeMinor,
        reservedMinor: snap.reservedMinor,
        bufferMinor: snap.bufferMinor,
        daysUntilIncome: snap.daysUntilIncome,
        goals,
        recent,
      },
    };
  } catch (error) {
    console.error("[numa] loadHomeSnapshot failed", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte hämta din ekonomi",
    };
  }
}
