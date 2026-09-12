"use client";

import { LoginBootClear } from "@/components/auth/LoginBoot";
import { BottomNav } from "@/components/layout/BottomNav";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { LastViewOutlet } from "@/components/layout/LastViewOutlet";
import { NavIntentProvider } from "@/components/layout/NavIntent";
import { NavWarmup } from "@/components/layout/NavWarmup";
import { SideNav } from "@/components/layout/SideNav";
import { TabKeepAlive } from "@/components/layout/TabKeepAlive";
import type { HomeSnapshot } from "@/features/finance/load-home";

/**
 * Canonical NUMA shell — soft client navigation with prefetch warmup.
 * Clears login boot as soon as the shell mounts so Hem can show its
 * last-known / skeleton while the snapshot fetch finishes (SPEC 6 / issue 107).
 * homeCookieShell SSR into keep-alive Hem — required for warm hard-refresh
 * first Kvar/Över (module hydrate alone cannot SSR).
 */
export function AppShell({
  children,
  displayName,
  homeCookieShell = null,
}: {
  children: React.ReactNode;
  displayName: React.ReactNode;
  homeCookieShell?: HomeSnapshot | null;
}) {
  return (
    <NavIntentProvider>
      <LoginBootClear />
      <div className="mx-auto min-h-dvh w-full max-w-[var(--numa-shell-max)] overflow-x-clip pl-[max(1rem,var(--numa-safe-left))] pr-[max(1rem,var(--numa-safe-right))] md:px-8">
        <NavWarmup />
        <div className="flex gap-8 md:gap-12">
          <SideNav displayName={displayName} />
          <div className="min-w-0 flex-1">
            <header className="min-w-0 pb-3 pt-[max(0.95rem,var(--numa-safe-top))] md:hidden">
              <a href="/idag" className="numa-press block min-h-11 min-w-0">
                <BrandLockup />
                <span
                  className="mt-1 block truncate pl-[calc(1.875rem+0.55rem)] text-[13px] font-semibold tracking-tight text-[var(--numa-muted)]"
                  title={typeof displayName === "string" ? displayName : undefined}
                >
                  {displayName}
                </span>
              </a>
            </header>

            <main className="mx-auto w-full min-w-0 max-w-[var(--numa-content-max)] pb-[var(--numa-shell-pad-bottom)] pt-3 md:max-w-none md:pb-16 md:pt-10">
              <TabKeepAlive homeCookieShell={homeCookieShell}>
                <LastViewOutlet>{children}</LastViewOutlet>
              </TabKeepAlive>
            </main>
          </div>
        </div>
        <BottomNav />
      </div>
    </NavIntentProvider>
  );
}
