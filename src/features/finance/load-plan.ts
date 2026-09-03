import { unstable_rethrow } from "next/navigation";
import {
  discretionarySpendingByMonthKey,
  type CanonicalTransaction,
  type PlanItem,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { loadErrorMessageSv } from "@/lib/async";

export type PlanSnapshot = {
  items: PlanItem[];
  currency: CurrencyCode;
  timeZone: string;
  bankBalanceMinor: number | null;
  spendingByMonthKey: Record<string, number>;
  ledgerTransactions: CanonicalTransaction[];
  financeRevision: string;
  verifiedAt: string;
  truthStatus: "verified" | "stale" | "unavailable";
};

export type PlanSnapshotResult =
  | { ok: true; data: PlanSnapshot }
  | { ok: false; error: string };

export async function loadPlanSnapshot(): Promise<PlanSnapshotResult> {
  try {
    const snap = await getCachedTodaySnapshot();
    return {
      ok: true,
      data: {
        items: snap.planItems ?? [],
        currency: snap.currency,
        timeZone: snap.profile.timezone || "Asia/Bangkok",
        bankBalanceMinor: snap.calculatedBalanceMinor,
        spendingByMonthKey: discretionarySpendingByMonthKey({
          transactions: snap.ledgerTransactions ?? [],
          planItems: snap.planItems ?? [],
          currency: snap.currency,
          timeZone: snap.profile.timezone || "Asia/Bangkok",
        }),
        ledgerTransactions: snap.ledgerTransactions ?? [],
        financeRevision: snap.financeRevision,
        verifiedAt: snap.verifiedAt,
        truthStatus: "verified",
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[numa] loadPlanSnapshot failed", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte ladda planen"),
    };
  }
}
