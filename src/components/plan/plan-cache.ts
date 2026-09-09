import {
  rememberPlanSnapshot,
  syncHomeLivingFromPlan,
  type PlanSnapshot,
} from "@/features/home/last-snapshot";

export function rememberLivePlan(snapshot: PlanSnapshot) {
  rememberPlanSnapshot(snapshot);
  syncHomeLivingFromPlan(snapshot);
}
