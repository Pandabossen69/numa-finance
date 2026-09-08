"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** In-app paths only — skip https:// production links from Mer. */
export function canPrefetchHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Auto/partial prefetch only. A full-payload prefetch fetched the entire
 * Hem/Plan/Analys snapshot and Next waited for that in-flight payload
 * before swapping the outlet — old content stayed until 2.6–3.6s of
 * RSC/data arrived. Default prefetch warms loading.tsx so the dest
 * shell can paint immediately.
 */
export function prefetchHref(router: AppRouterInstance, href: string) {
  if (!canPrefetchHref(href)) return;
  try {
    router.prefetch(href);
  } catch {
    // Prefetch is best-effort.
  }
}

export function warmHrefs(router: AppRouterInstance, hrefs: readonly string[]) {
  for (const href of hrefs) prefetchHref(router, href);
}

/** Idle so first paint / first tap is not competing with 7 route prefetches. */
export function scheduleIdleWarm(fn: () => void): () => void {
  let idleId = 0;
  let timeoutId = 0;
  if (typeof requestIdleCallback === "function") {
    idleId = requestIdleCallback(fn, { timeout: 1_500 });
  } else {
    timeoutId = window.setTimeout(fn, 250);
  }
  return () => {
    if (idleId && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(idleId);
    }
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}

export function usePrefetchOnIntent() {
  const router = useRouter();
  return {
    prefetch: (href: string) => prefetchHref(router, href),
    warm: (hrefs: readonly string[]) => warmHrefs(router, hrefs),
  };
}

/** Prefetch destinations on idle and when the tab becomes visible again. */
export function DestinationWarmup({ hrefs }: { hrefs: readonly string[] }) {
  const router = useRouter();
  const key = hrefs.join("\0");

  useEffect(() => {
    let cancelled = false;
    let cancelIdle = () => {};
    const warm = () => {
      if (cancelled) return;
      warmHrefs(router, hrefs);
    };
    cancelIdle = scheduleIdleWarm(warm);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      cancelIdle();
      cancelIdle = scheduleIdleWarm(warm);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      cancelIdle();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // hrefs is compared via key so callers can pass inline arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, key]);

  return null;
}
