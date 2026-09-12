import { HemRouteClient } from "@/components/home/HemRouteClient";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export const dynamic = "force-dynamic";

/**
 * Client-first Hem. RSC does not await the live money snapshot — cookie /
 * last-known may paint as a provisional shell immediately; quiet fetch
 * confirms behind (#107 + Christian-bar).
 */
export default async function IdagPage() {
  const cookieShell = await readLastHomeCookie();
  return <HemRouteClient cookieShell={cookieShell} />;
}
