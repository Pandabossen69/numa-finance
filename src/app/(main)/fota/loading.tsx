import { FotaScreen } from "@/components/capture/FotaScreen";
import { LoadingSlot } from "@/components/layout/LoadingSlot";

/** Dest-shaped Fota — last-known boot when warm, not a blank skeleton. */
export default function FotaLoading() {
  return (
    <LoadingSlot>
      <FotaScreen data={null} />
    </LoadingSlot>
  );
}
