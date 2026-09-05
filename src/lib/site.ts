/** Stable production URL — always prefer this over Vercel preview links. */
export const PRODUCTION_HOST = "numa-finance.vercel.app";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;
export const PREVIEW_COOKIE = "numa_preview";
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function hasPreviewQuery(
  searchParams?: URLSearchParams | { get(name: string): string | null } | null,
): boolean {
  return searchParams?.get("preview") === "1";
}

export function hasPreviewCookie(cookieHeader?: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => {
    const [name, value] = part.trim().split("=");
    return name === PREVIEW_COOKIE && value === "1";
  });
}

export function hasPreviewEscape(
  searchParams?: URLSearchParams | { get(name: string): string | null } | null,
  cookieHeader?: string | null,
): boolean {
  return hasPreviewQuery(searchParams) || hasPreviewCookie(cookieHeader);
}

export function withPreviewQuery(path: string): string {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("preview", "1");
  const next = params.toString();
  return `${pathname}?${next}`;
}

export function hostnameWithoutPort(hostname: string): string {
  return hostname.toLowerCase().split(":")[0] ?? "";
}

export function isCanonicalAppHost(hostname: string): boolean {
  const host = hostnameWithoutPort(hostname);
  if (host === PRODUCTION_HOST) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return false;
}

/**
 * This project's Vercel preview / unique deployment aliases.
 * Production is `numa-finance.vercel.app` (dot, not a trailing hyphen).
 */
export function isProjectVercelAlias(hostname: string): boolean {
  const host = hostnameWithoutPort(hostname);
  return host.endsWith(".vercel.app") && host.startsWith("numa-finance-");
}

/** True when the PWA / browser is already on the shared production host. */
export function isProductionAppHost(hostname: string): boolean {
  return hostnameWithoutPort(hostname) === PRODUCTION_HOST;
}

/**
 * Bounce leftover team / other-app *.vercel.app hosts to production so an
 * installed phone app cannot stick on a random URL. This project's own
 * preview and deployment aliases must stay put — otherwise PR acceptance
 * and in-preview login land on production.
 * Escape hatch for other hosts: ?preview=1 or numa_preview=1.
 */
export function shouldRedirectToProduction(
  hostname: string,
  searchParams?: URLSearchParams | { get(name: string): string | null },
  cookieHeader?: string | null,
): boolean {
  if (hasPreviewEscape(searchParams, cookieHeader)) return false;
  if (isCanonicalAppHost(hostname)) return false;
  if (isProjectVercelAlias(hostname)) return false;
  const host = hostnameWithoutPort(hostname);
  return host.endsWith(".vercel.app");
}

export function productionUrlForPath(pathname: string, search = ""): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${PRODUCTION_ORIGIN}${path}${search}`;
}
