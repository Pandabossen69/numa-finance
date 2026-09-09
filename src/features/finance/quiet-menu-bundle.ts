"use server";

import { getPlanPageDataAction } from "@/components/plan/load-plan";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";
import type { AnalysSnapshot } from "@/features/finance/load-analys";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import type { GettingStartedView } from "@/features/getting-started/progress";

export type QuietMenuBundle = {
  plan: PlanSnapshot | null;
  gettingStarted: GettingStartedView | null;
  analys: AnalysSnapshot | null;
  movements: MovementsSnapshot | null;
};

export type QuietMenuBundleResult =
  | { ok: true; data: QuietMenuBundle }
  | { ok: false; error: string };

/**
 * One quiet round-trip after Hem paints. Plan + Analys share the request-scoped
 * TodaySnapshot cache; Movements uses the bounded ledger window. Failures must
 * never clear last-known client caches (NextStep quiet-reload pattern).
 */
export async function getQuietMenuBundleAction(): Promise<QuietMenuBundleResult> {
  try {
    const [planPage, analys, movements] = await Promise.all([
      getPlanPageDataAction(),
      loadAnalysSnapshot(),
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
        analys: analys.ok ? analys.data : null,
        movements: movements.ok ? movements.data : null,
      },
    };
  } catch (error) {
    console.error("[numa] quiet menu bundle failed", error);
    return { ok: false, error: "quiet-menu-bundle-failed" };
  }
}
