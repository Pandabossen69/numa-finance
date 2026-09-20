/**
 * Destinations that must switch in the same tick as the tap — no App Router
 * soft-nav / force-dynamic RSC. NextStep Sales keeps panels mounted; we do the
 * same under the NUMA shell. Fota (+) is keep-alive so dest chrome is not
 * parked under the hidden RSC shadow.
 */

export const SPA_TAB_HREFS = [
  "/idag",
  "/plan",
  "/analys",
  "/mer",
  "/transaktioner",
  "/fota",
] as const;

export type SpaTabHref = (typeof SPA_TAB_HREFS)[number];

export function spaTabKey(pathname: string): SpaTabHref | null {
  const path = (pathname.split("?")[0] ?? pathname).split("#")[0] ?? pathname;
  if (path === "/" || path === "/idag" || path.startsWith("/idag/")) {
    return "/idag";
  }
  if (path === "/plan" || path.startsWith("/plan/")) return "/plan";
  if (path === "/analys" || path.startsWith("/analys/")) return "/analys";
  if (path === "/mer") return "/mer";
  if (path === "/transaktioner" || path.startsWith("/transaktioner/")) {
    return "/transaktioner";
  }
  if (path === "/fota" || path.startsWith("/fota/")) return "/fota";
  return null;
}

export function isSpaTabHref(href: string): boolean {
  return spaTabKey(href) != null;
}
