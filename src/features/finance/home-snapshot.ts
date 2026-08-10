"use server";

import { NEXT_INCOME_NAME } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getTodaySnapshot } from "@/lib/store/repository";

export type HomeSnapshot = {
  primaryAccountId: string | null;
  currency: CurrencyCode;
  calculatedBalanceMinor: number | null;
  verificationLabel: string | null;
  checkpointVerifiedAt: string | null;
  todaySpendingMinor: number;
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

/** Slim DTO for Hem — avoids shipping full TodaySnapshot over the wire. */
export async function getHomeSnapshotAction(): Promise<HomeSnapshotResult> {
  try {
    const snap = await getTodaySnapshot();
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
        calculatedBalanceMinor: snap.calculatedBalanceMinor,
        verificationLabel: snap.verificationLabel,
        checkpointVerifiedAt: snap.checkpoint?.verifiedAt ?? null,
        todaySpendingMinor: snap.todaySpendingMinor,
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
    console.error("[numa] getHomeSnapshotAction failed", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte hämta din ekonomi",
    };
  }
}
