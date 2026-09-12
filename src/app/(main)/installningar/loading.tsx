import { LoadingSlot } from "@/components/layout/LoadingSlot";
import { InstallningarScreen } from "@/components/mer/InstallningarScreen";

/** Dest-shaped Inställningar — last-known when warm, not a blank skeleton. */
export default function InstallningarLoading() {
  return (
    <LoadingSlot>
      <InstallningarScreen data={null} />
    </LoadingSlot>
  );
}
