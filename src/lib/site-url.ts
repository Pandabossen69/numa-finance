import { headers } from "next/headers";
import { LOCAL_ORIGIN, normalizeOrigin, originFromHeaders } from "./origin";

/**
 * Origin used to build Supabase email redirect links. An explicit
 * NEXT_PUBLIC_SITE_URL wins so the value always matches the redirect
 * allow-list configured in Supabase.
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  try {
    const headerList = await headers();
    const fromRequest = originFromHeaders((name) => headerList.get(name));
    if (fromRequest) return fromRequest;
  } catch {
    // No request context (e.g. during build) — fall back to localhost.
  }

  return LOCAL_ORIGIN;
}
