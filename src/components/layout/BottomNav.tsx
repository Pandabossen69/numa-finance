"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isNavActive } from "@/components/layout/nav";

export function BottomNav() {
  const pathname = usePathname();
  const left = PRIMARY_NAV.slice(0, 2);
  const right = PRIMARY_NAV.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--numa-border)] bg-[var(--numa-nav)] md:hidden"
      style={{ paddingBottom: "var(--numa-safe-bottom)" }}
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5 pb-2">
        {left.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            active={isNavActive(pathname, tab.href)}
          />
        ))}
        <div className="flex justify-center">
          <Link
            href="/lagg-till"
            prefetch
            className="relative -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--numa-accent)] text-3xl font-light text-white shadow-[var(--numa-shadow)] transition active:scale-95"
            aria-label="Lägg till eller fota"
          >
            <span className="leading-none">+</span>
          </Link>
        </div>
        {right.map((tab) => (
          <NavItem
            key={tab.href}
            href={tab.href}
            label={tab.label}
            active={isNavActive(pathname, tab.href)}
          />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold tracking-wide transition ${
        active ? "text-[var(--numa-accent-ink)]" : "text-[var(--numa-faint)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-[var(--numa-accent)]" : "bg-transparent"
        }`}
        aria-hidden
      />
      {label}
    </Link>
  );
}
