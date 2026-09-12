import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { LoadingSlot } from "@/components/layout/LoadingSlot";

/** Dest-shaped Saldo — last-known accounts when warm, not a blank skeleton. */
export default function KontonLoading() {
  return (
    <LoadingSlot>
      <AccountsDashboard data={null} />
    </LoadingSlot>
  );
}
