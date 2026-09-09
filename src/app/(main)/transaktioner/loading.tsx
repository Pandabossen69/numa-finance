import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { MovementsScreen } from "@/components/movements/MovementsScreen";

/** Dest-shaped shell — last-known list, never a blocking skeleton. */
export default function TransaktionerLoading() {
  return (
    <LoadingSlot>
      <MovementsScreen data={null} />
    </LoadingSlot>
  );
}
