import { unstable_rethrow } from "next/navigation";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { getCachedTodaySnapshot } from "@/features/finance/load-home";
import { loadErrorMessageSv } from "@/lib/async";
import { reportError } from "@/lib/observe/report";
import { planSnapshotFromToday } from "./snapshot-from-today";

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
    return { ok: true, data: planSnapshotFromToday(snap) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[numa] loadPlanSnapshot failed", error);
    void reportError("loader.plan", error);
    return {
      ok: false,
      error: loadErrorMessageSv(error, "Kunde inte ladda planen"),
    };
  }
}
