"use client";

import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { SideNav } from "@/components/layout/SideNav";

/**
 * Canonical NUMA shell — soft client navigation with prefetch.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] px-4 md:px-8">
      <div className="flex gap-8 md:gap-12">
        <SideNav />
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between pt-[max(1rem,var(--numa-safe-top))] pb-2 md:hidden">
            <Link href="/idag" prefetch className="block">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--numa-faint)]">
                NUMA
              </span>
              <span className="mt-0.5 block text-xl font-semibold tracking-tight text-[var(--numa-ink)]">
                Din ekonomi
              </span>
            </Link>
            <Link
              href="/fota"
              prefetch
              className="rounded-full bg-[var(--numa-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--numa-accent-ink)]"
            >
              Fota
            </Link>
          </header>

          <main className="mx-auto w-full max-w-[var(--numa-content-max)] pb-[calc(6.25rem+var(--numa-safe-bottom))] pt-2 md:max-w-none md:pb-12 md:pt-8">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
