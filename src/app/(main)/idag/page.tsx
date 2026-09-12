import { HemRouteClient } from "@/components/home/HemRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Hem. RSC does not await the live money snapshot — keep-alive
 * + last-known / cookie shell paint immediately; quiet fetch confirms behind.
 */
export default function IdagPage() {
  return <HemRouteClient />;
}
