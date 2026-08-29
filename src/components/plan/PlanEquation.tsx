import { SV } from "@/features/copy/labels-sv";
import { formatPlanFigure } from "@/components/plan/plan-format";

export function PlanEquation({
  breakdown,
  restLabel,
}: {
  breakdown: { totalMinor: number; settledMinor: number; remainingMinor: number };
  restLabel?: string | null;
}) {
  return (
    <p className="numa-settle-eq">
      <span className="money">{formatPlanFigure(breakdown.totalMinor)}</span>
      <span aria-hidden>−</span>
      <span className="money">{formatPlanFigure(breakdown.settledMinor)}</span>
      <span aria-hidden>=</span>
      <span className="money is-remain">
        {formatPlanFigure(breakdown.remainingMinor)}
      </span>
      {restLabel ? (
        <span className="numa-settle-rest">
          · {SV.resten} {restLabel}
        </span>
      ) : null}
    </p>
  );
}
