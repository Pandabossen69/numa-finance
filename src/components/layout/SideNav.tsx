"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isNavActive } from "@/components/layout/nav";

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 md:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-8 py-8 pr-4">
        <Link href="/idag" prefetch className="group block px-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--numa-faint)]">
            Personlig ekonomi
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)] transition group-hover:text-[var(--numa-accent-ink)]">
            NUMA
          </p>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Sido­navigering">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`rounded-2xl px-3 py-3 transition ${
                  active
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                    : "text-[var(--numa-muted)] hover:bg-white/50 hover:text-[var(--numa-ink)]"
                }`}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--numa-faint)]">
                  {item.hint}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/fota"
          prefetch
          className="rounded-2xl bg-[var(--numa-accent)] px-4 py-3.5 text-center text-sm font-semibold text-white shadow-[var(--numa-shadow-sm)] transition hover:brightness-105 active:scale-[0.99]"
        >
          + Fota eller lägg till
        </Link>
      </div>
    </aside>
  );
}
