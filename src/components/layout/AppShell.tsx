"use client";

import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { LastViewOutlet } from "@/components/layout/LastViewOutlet";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { NavWarmup } from "@/components/layout/NavWarmup";
import { SideNav } from "@/components/layout/SideNav";

/**
 * Canonical NUMA shell — soft client navigation with prefetch warmup.
 */
export function AppShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName: string;
}) {
  return (
    <NavIntentProvider>
      <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] pr-[max(1rem,env(safe-area-inset-right,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] md:px-8">
        <NavWarmup />
        <div className="flex gap-8 md:gap-12">
          <SideNav displayName={displayName} />
          <div className="min-w-0 flex-1">
            <header className="border-b border-[var(--numa-border)]/70 pt-[max(0.75rem,var(--numa-safe-top))] pb-2 md:hidden">
              <Link href="/idag" prefetch className="numa-press block min-w-0">
                <span className="numa-brand-mark">NUMA</span>
                <span
                  className="mt-0.5 block truncate text-[13px] font-semibold tracking-tight text-[var(--numa-ink)]"
                  title={displayName}
                >
                  {displayName}
                </span>
              </Link>
            </header>

            <main className="mx-auto w-full max-w-[var(--numa-content-max)] pt-2 pb-[var(--numa-shell-pad-bottom)] md:max-w-none md:pt-10 md:pb-16">
              <LastViewOutlet>{children}</LastViewOutlet>
            </main>
          </div>
        </div>
        <BottomNav />
      </div>
    </NavIntentProvider>
  );
}
