import type { PlanListStatus } from "@/domain/finance";
import { SV, planDoneLabel, type PlanSettleKind } from "@/features/copy/labels-sv";

/**
 * What a settled row is called and how it looks, decided once.
 *
 * Plan and Analys both render this chip. Keeping the label and the class here
 * means the two screens cannot drift into saying different things about the
 * same row — which is exactly how Analys ended up ignoring Delvis and Betald.
 */
export function planChipLabel(
  status: PlanListStatus,
  kind: PlanSettleKind,
): string | null {
  if (status === "settled") return planDoneLabel(kind);
  if (status === "partial") return SV.delvis;
  return null;
}

export function planChipClass(status: PlanListStatus): string {
  return status === "settled"
    ? "numa-chip numa-chip-mint"
    : "numa-chip numa-chip-spend";
}
