import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { ImporteraScreen } from "@/components/mer/ImporteraScreen";

/** Dest-shaped Tidigare bilder — last-known rows when warm, not a blank skeleton. */
export default function ImporteraLoading() {
  return (
    <LoadingSlot>
      <ImporteraScreen data={null} />
    </LoadingSlot>
  );
}
