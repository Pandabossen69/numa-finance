import { MerRouteClient } from "@/components/mer/MerRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Mer. Profile/admin no longer block the Suspense shell —
 * last-known paints immediately under SPA keep-alive.
 */
export default function MerPage() {
  return <MerRouteClient />;
}
