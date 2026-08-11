"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isNavActive } from "@/components/layout/nav";

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-10 py-10 pr-2">
        <Link href="/idag" prefetch className="group block px-1">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-[var(--numa-faint)]">
            Personlig ekonomi
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--numa-ink)] transition group-hover:text-[var(--numa-accent-ink)]">
            NUMA
          </p>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Sido­navigering">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`relative px-1 py-3 transition ${
                  active
                    ? "text-[var(--numa-ink)]"
                    : "text-[var(--numa-muted)] hover:text-[var(--numa-ink)]"
                }`}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--numa-accent)]"
                    aria-hidden
                  />
                ) : null}
                <span className="block pl-3 text-sm font-semibold tracking-tight">
                  {item.label}
                </span>
                <span className="mt-0.5 block pl-3 text-xs text-[var(--numa-faint)]">
                  {item.hint}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/lagg-till"
          prefetch
          className="rounded-full bg-[var(--numa-ink)] px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-[var(--numa-accent)] active:scale-[0.99]"
        >
          + Lägg till
        </Link>
      </div>
    </aside>
  );
}
