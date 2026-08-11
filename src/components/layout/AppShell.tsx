"use client";

import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { NavWarmup } from "@/components/layout/NavWarmup";
import { SideNav } from "@/components/layout/SideNav";

/**
 * Canonical NUMA shell — soft client navigation with prefetch warmup.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:px-8">
      <NavWarmup />
      <div className="flex gap-8 md:gap-12">
        <SideNav />
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between pt-[max(0.85rem,var(--numa-safe-top))] pb-1 md:hidden">
            <Link href="/idag" prefetch className="block min-w-0">
              <span className="text-[1.35rem] font-semibold tracking-tight text-[var(--numa-ink)]">
                NUMA
              </span>
            </Link>
          </header>

          <main className="mx-auto w-full max-w-[var(--numa-content-max)] pb-[calc(7.75rem+var(--numa-safe-bottom))] pt-1 md:max-w-none md:pb-14 md:pt-8">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
