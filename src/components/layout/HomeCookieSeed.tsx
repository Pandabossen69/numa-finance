"use client";

import { useLayoutEffect } from "react";
import type { HomeSnapshot } from "@/features/finance/load-home";
import { seedHomeLoginShell } from "@/features/home/last-snapshot";

/**
 * Seeds last-home cookie into the provisional module shell without remounting
 * TabKeepAlive. Layout must mount AppShell synchronously — awaiting the cookie
 * behind Suspense fallback={null} blanked login→Hem even when AuthExperience
 * had already seeded lastHomeShellSnapshot (SPEC 6 first Kvar/Över).
 */
export function HomeCookieSeed({ shell }: { shell: HomeSnapshot | null }) {
  useLayoutEffect(() => {
    seedHomeLoginShell(shell);
  }, [shell]);
  return null;
}
