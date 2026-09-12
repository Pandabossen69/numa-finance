import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { MerScreen } from "@/components/mer/MerScreen";

/** Dest-shaped Mer — last-known hub, not an empty mint skeleton. */
export default function MerLoading() {
  return (
    <LoadingSlot>
      <MerScreen data={null} />
    </LoadingSlot>
  );
}
