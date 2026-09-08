import { PlanFirstPaint } from "@/components/layout/HemFirstPaint";
import { LoadingSlot } from "@/components/layout/LoadingSlot";

export default function PlanLoading() {
  return (
    <LoadingSlot>
      <PlanFirstPaint />
    </LoadingSlot>
  );
}
