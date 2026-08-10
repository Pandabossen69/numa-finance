export const PRIMARY_NAV = [
  { href: "/idag", label: "Hem", hint: "Tryggt idag" },
  { href: "/plan", label: "Plan", hint: "Månad & mål" },
  { href: "/analys", label: "Analys", hint: "Mönster" },
  { href: "/mer", label: "Mer", hint: "Konto & import" },
] as const;

export const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
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
