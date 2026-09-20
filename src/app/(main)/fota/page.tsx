import { FotaRouteClient } from "@/components/capture/FotaRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Fota. Soft-nav is SPA keep-alive — last-known capture chrome
 * paints the same tick. Do not await the home snapshot or RSC Flight here.
 * `?mode=` / `?observation=` are read on the client (Plan `?steg=` pattern).
 */
export default function FotaPage() {
  return <FotaRouteClient />;
}
