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
  displayName: React.ReactNode;
}) {
  return (
    <NavIntentProvider>
      <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] overflow-x-clip pl-[max(1rem,var(--numa-safe-left))] pr-[max(1rem,var(--numa-safe-right))] md:px-8">
        <NavWarmup />
        <div className="flex gap-8 md:gap-12">
          <SideNav displayName={displayName} />
          <div className="min-w-0 flex-1">
            <header className="min-w-0 pb-3 pt-[max(0.95rem,var(--numa-safe-top))] md:hidden">
              <Link href="/idag" prefetch className="numa-press block min-h-11 min-w-0">
                <span className="numa-brand-mark inline-flex items-baseline gap-0">
                  NUMA
                </span>
                <span
                  className="mt-0.5 block truncate text-[13px] font-semibold tracking-tight text-[var(--numa-muted)]"
                  title={typeof displayName === "string" ? displayName : undefined}
                >
                  {displayName}
                </span>
              </Link>
            </header>

            <main className="mx-auto w-full min-w-0 max-w-[var(--numa-content-max)] pb-[var(--numa-shell-pad-bottom)] pt-3 md:max-w-none md:pb-16 md:pt-10">
              <LastViewOutlet>{children}</LastViewOutlet>
            </main>
          </div>
        </div>
        <BottomNav />
      </div>
    </NavIntentProvider>
  );
}
