import { ImporteraRouteClient } from "@/components/mer/ImporteraRouteClient";

export const dynamic = "force-dynamic";

/**
 * Thin route. The observation list used to be awaited here and shipped in
 * the RSC flight. Next keeps that flight for at least 30s, so soft-nav
 * showed mails that were already confirmed or rejected. The list now lives
 * in the client store (see ImporteraRouteClient).
 */
export default function ImporteraPage() {
  return <ImporteraRouteClient />;
}
