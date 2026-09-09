import { HemRouteClient } from "@/components/home/HemRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Hem. RSC no longer awaits the money snapshot — SPA keep-alive
 * + last-known paint immediately; quiet fetch refreshes in the background.
 */
export default function IdagPage() {
  return <HemRouteClient />;
}
