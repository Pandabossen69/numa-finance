export type NavIconName = "home" | "plan" | "analys" | "mer";

export const PRIMARY_NAV = [
  { href: "/idag", label: "Hem", hint: "Idag", icon: "home" as const },
  { href: "/plan", label: "Plan", hint: "Framåt", icon: "plan" as const },
  { href: "/analys", label: "Analys", hint: "Mönster", icon: "analys" as const },
  { href: "/mer", label: "Mer", hint: "Övrigt", icon: "mer" as const },
] as const;

export const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
  "/fota",
  "/lagg-till",
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
