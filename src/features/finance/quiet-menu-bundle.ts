"use server";

import { getPlanPageDataAction } from "@/components/plan/load-plan";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";
import type { MerSnapshot } from "@/features/home/last-snapshot";

export type QuietMenuBundle = {
  plan: PlanSnapshot | null;
  gettingStarted: GettingStartedView | null;
  analys: AnalysSnapshot | null;
  movements: MovementsSnapshot | null;
  /** From Plan's TodaySnapshot — no extra ledger read. */
  accounts: AccountsSnapshot | null;
  /**
   * Mer hub chrome. Server leaves this null — a profile/admin read here
   * would block Plan/Rörelser last-known the way a second Analys load did.
   * Client gap-fills from Hem and quiet-refreshes isAdmin after idle.
   */
  mer: MerSnapshot | null;
};

export type QuietMenuBundleResult =
  | { ok: true; data: QuietMenuBundle }
  | { ok: false; error: string };

/**
 * One quiet round-trip after Hem paints. Plan last-known is enough for the
 * client to derive a paint-able Analys snapshot (same TodaySnapshot fields).
 * A second Analys snapshot load here blocked Plan/Rörelser warm and raced the
 * dest Flight POST. Failures must never clear last-known client caches.
 */
export async function getQuietMenuBundleAction(): Promise<QuietMenuBundleResult> {
  try {
    const [planPage, movements] = await Promise.all([
      getPlanPageDataAction(),
      loadMovementsSnapshot(),
    ]);

    let plan: PlanSnapshot | null = null;
    let gettingStarted: GettingStartedView | null = null;
    if (planPage.ok) {
      const { gettingStarted: gs, ...planFields } = planPage.data;
      gettingStarted = gs;
      plan = planFields;
    }

    return {
      ok: true,
      data: {
        plan,
        gettingStarted,
        // Client gap-fills from Plan + Hem — no extra Analys action.
        analys: null,
        movements: movements.ok ? movements.data : null,
        // Same TodaySnapshot as Plan — a second ledger read here would
        // block Plan/Analys/Rörelser last-known on the idle warm.
        accounts: plan?.accounts ?? null,
        // Client gap-fills from Hem — no extra profile/admin read here.
        mer: null,
      },
    };
  } catch (error) {
    console.error("[numa] quiet menu bundle failed", error);
    return { ok: false, error: "quiet-menu-bundle-failed" };
  }
}
