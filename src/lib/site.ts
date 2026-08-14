/** Stable production URL — always prefer this over Vercel preview links. */
export const PRODUCTION_HOST = "numa-finance.vercel.app";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;

export function isCanonicalAppHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  if (host === PRODUCTION_HOST) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false;
}

/**
 * Temporary Vercel URLs (preview deploys / team *.vercel.app) should bounce
 * to production so the phone home-screen app always hits the live build.
 * Escape hatch: ?preview=1 (for intentional PR testing).
 */
export function shouldRedirectToProduction(
  hostname: string,
  searchParams?: URLSearchParams | { get(name: string): string | null },
): boolean {
  if (searchParams?.get("preview") === "1") return false;
  if (isCanonicalAppHost(hostname)) return false;
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  return host.endsWith(".vercel.app");
}

export function productionUrlForPath(pathname: string, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${PRODUCTION_ORIGIN}${path}${search}`;
}
