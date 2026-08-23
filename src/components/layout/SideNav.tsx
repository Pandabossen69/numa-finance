"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import {
  PRIMARY_NAV,
  isNavActive,
  optimisticNavPath,
} from "@/components/layout/nav";

export function SideNav({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{
    href: string;
    fromPath: string;
  } | null>(null);
  const highlightPath = optimisticNavPath(pathname, pending);

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-10 py-10 pr-2">
        <Link href="/idag" prefetch className="group block px-1">
          <p className="numa-section-title">Personlig ekonomi</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[var(--numa-ink)] transition group-hover:text-[var(--numa-accent-ink)]">
            NUMA
          </p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-[var(--numa-accent-ink)]">
            {displayName}
          </p>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Sido­navigering">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(highlightPath, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => setPending({ href: item.href, fromPath: pathname })}
                className={`numa-press relative rounded-2xl px-1 py-3 ${
                  active
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-ink)] shadow-[inset_0_0_0_1px_rgba(12,125,104,0.16)]"
                    : "text-[var(--numa-muted)] hover:bg-white/70 hover:text-[var(--numa-ink)]"
                }`}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[var(--numa-accent)]"
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

        <div className="space-y-2">
          <Link
            href="/fota"
            prefetch
            className="numa-btn numa-btn-accent w-full rounded-full"
          >
            Fota
          </Link>
          <SignOutButton variant="nav" />
        </div>
      </div>
    </aside>
  );
}
