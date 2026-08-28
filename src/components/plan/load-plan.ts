"use server";

import { loadPlanSnapshot } from "@/features/finance/load-plan";
import { loadGettingStartedView } from "@/features/getting-started/load";
import type { GettingStartedView } from "@/features/getting-started/progress";
import type { PlanSnapshot } from "@/features/finance/load-plan";

export type PlanPageData = PlanSnapshot & {
  gettingStarted: GettingStartedView | null;
};

export type PlanPageDataResult =
  | { ok: true; data: PlanPageData }
  | { ok: false; error: string };

export async function getPlanPageDataAction(): Promise<PlanPageDataResult> {
  const [result, gettingStarted] = await Promise.all([
    loadPlanSnapshot(),
    loadGettingStartedView(),
  ]);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      ...result.data,
      gettingStarted,
    },
  };
}
