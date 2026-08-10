"use client";

import { usePathname } from "next/navigation";

const tabs = [
  { href: "/idag", label: "Hem", icon: "●" },
  { href: "/plan", label: "Plan", icon: "▣" },
  { href: "/analys", label: "Analys", icon: "◔" },
  { href: "/mer", label: "Mer", icon: "☰" },
] as const;

const MER_PREFIXES = [
  "/mer",
  "/konton",
  "/transaktioner",
  "/importera",
  "/installningar",
  "/fota",
  "/laga",
];

/** Plain anchors only — soft RSC nav + poisoned SW = blank main. */
export function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/mer") {
      return MER_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
    }
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-[var(--numa-border)] bg-[var(--numa-nav)]"
      style={{ paddingBottom: "var(--numa-safe-bottom)" }}
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto flex max-w-[28rem] items-center justify-end px-4 pt-1">
        <a
          href="/laga"
          className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--numa-accent)]"
        >
          Laga
        </a>
      </div>
      <div className="numa-shell grid grid-cols-5 items-end px-2 pt-1 pb-2">
        {tabs.slice(0, 2).map((tab) => (
          <NavLink
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={isActive(tab.href)}
          />
        ))}
        <div className="flex justify-center">
          <a
            href="/fota"
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--numa-accent)] text-3xl font-light text-white shadow-[var(--numa-shadow)] transition active:scale-95"
            aria-label="Lägg till"
          >
            <span className="leading-none">+</span>
          </a>
        </div>
        {tabs.slice(2).map((tab) => (
          <NavLink
            key={tab.href}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            active={isActive(tab.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium tracking-wide transition ${
        active ? "text-[var(--numa-accent-ink)]" : "text-[var(--numa-faint)]"
      }`}
    >
      <span className="text-[13px] leading-none" aria-hidden>
        {icon}
      </span>
      {label}
    </a>
  );
}
