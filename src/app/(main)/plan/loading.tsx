import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { PlanScreen } from "@/components/plan/PlanScreen";

/** Dest-shaped Plan shell so first visit paints last-known, not a spinner. */
export default function PlanLoading() {
  return (
    <LoadingSlot>
      <PlanScreen />
    </LoadingSlot>
  );
}
