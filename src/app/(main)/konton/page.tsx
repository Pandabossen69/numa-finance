import { AccountsRouteClient } from "@/components/accounts/AccountsRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Konton. The old RSC body awaited the full accounts ledger
 * so Mer→Konton sat on a blank dest. Last-known / dest shell paints now;
 * quiet-warm after Hem fills memory first.
 */
export default function KontonPage() {
  return <AccountsRouteClient />;
}
