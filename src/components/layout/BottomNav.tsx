"use client";

import { usePathname } from "next/navigation";

const tabs = [
  { href: "/idag", label: "Idag", icon: "●" },
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
  "/bank-sms",
  "/lagg-till",
];

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
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-[var(--numa-border)] bg-[var(--numa-nav)] backdrop-blur-xl"
      style={{ paddingBottom: "var(--numa-safe-bottom)" }}
      aria-label="Huvudnavigering"
    >
      <div className="numa-shell grid grid-cols-5 items-end px-2 pt-2 pb-2">
        <NavLink
          href={tabs[0].href}
          label={tabs[0].label}
          icon={tabs[0].icon}
          active={isActive(tabs[0].href)}
        />
        <NavLink
          href={tabs[1].href}
          label={tabs[1].label}
          icon={tabs[1].icon}
          active={isActive(tabs[1].href)}
        />

        <div className="flex justify-center">
          <a
            href="/lagg-till"
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--numa-accent)] text-3xl font-light text-white shadow-[var(--numa-shadow)] transition active:scale-95"
            aria-label="Lägg till"
          >
            <span className="leading-none">+</span>
          </a>
        </div>

        <NavLink
          href={tabs[2].href}
          label={tabs[2].label}
          icon={tabs[2].icon}
          active={isActive(tabs[2].href)}
        />
        <NavLink
          href={tabs[3].href}
          label={tabs[3].label}
          icon={tabs[3].icon}
          active={isActive(tabs[3].href)}
        />
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
