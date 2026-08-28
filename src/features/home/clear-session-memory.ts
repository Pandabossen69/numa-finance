import { clearPlanWarmup } from "@/components/plan/plan-cache";
import { clearAllLastKnown } from "@/features/home/last-snapshot";

/**
 * Wipe client last-known + Plan warmup so the next session cannot paint
 * another user's money. Server actions cannot touch this heap.
 */
export function clearClientSessionMemory() {
  clearAllLastKnown();
  clearPlanWarmup();
}
