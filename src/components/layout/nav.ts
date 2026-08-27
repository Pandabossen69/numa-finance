export type NavIconName = "home" | "plan" | "analys" | "mer";

export const PRIMARY_NAV = [
  { href: "/idag", label: "Hem", hint: "Kvar idag", icon: "home" as const },
  { href: "/plan", label: "Plan", hint: "Plan och sparande", icon: "plan" as const },
  { href: "/analys", label: "Analys", hint: "Perioden", icon: "analys" as const },
  { href: "/mer", label: "Mer", hint: "Övrigt", icon: "mer" as const },
] as const;

export const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
  "/laga",
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/mer") {
    return MER_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
  }
  if (href === "/idag") {
    return (
      pathname === "/" ||
      pathname === "/idag" ||
      pathname.startsWith("/idag/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary tab for last-view hold. Mer children stay on Mer — do not hold. */
export function primaryTab(pathname: string): string | null {
  if (pathname === "/fota" || pathname.startsWith("/fota/") || pathname.startsWith("/lagg-till")) {
    return "/fota";
  }
  for (const item of PRIMARY_NAV) {
    if (isNavActive(pathname, item.href)) return item.href;
  }
  return null;
}

/**
 * True on the tab root (Hem/Plan/Analys/Mer/Fota), not Mer drill-in.
 * Keep-alive caches only these so /konton does not overwrite Mer.
 */
export function isTabRoot(pathname: string): boolean {
  const tab = primaryTab(pathname);
  if (!tab) return false;
  if (tab === "/mer") return pathname === "/mer";
  if (tab === "/fota") {
    return (
      pathname === "/fota" ||
      pathname.startsWith("/fota/") ||
      pathname.startsWith("/lagg-till")
    );
  }
  return (
    pathname === tab ||
    pathname === "/" ||
    (tab === "/idag" && (pathname === "/idag" || pathname.startsWith("/idag/")))
  );
}

/** Highlight the tap target only while we are still on the page we left. */
export function optimisticNavPath(
  pathname: string,
  pending: { href: string; fromPath: string } | null,
): string {
  if (pending && pending.fromPath === pathname) return pending.href;
  return pathname;
}
