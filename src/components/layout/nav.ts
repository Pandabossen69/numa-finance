export const PRIMARY_NAV = [
  { href: "/idag", label: "Hem", hint: "Live dagsbudget" },
  { href: "/plan", label: "Plan", hint: "Månader framåt" },
  { href: "/analys", label: "Analys", hint: "Se mönster" },
  { href: "/mer", label: "Mer", hint: "Saldo & import" },
] as const;

export const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
  "/fota",
  "/lagg-till",
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
