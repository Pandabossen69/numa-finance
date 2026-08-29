"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** In-app paths only — skip https:// production links from Mer. */
export function canPrefetchHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/** force-dynamic tabs need `kind: "full"` or prefetch only warms loading.tsx. */
export function prefetchHref(router: AppRouterInstance, href: string) {
  if (!canPrefetchHref(href)) return;
  try {
    router.prefetch(href, {
      kind: "full",
    } as Parameters<typeof router.prefetch>[1]);
  } catch {
    // Prefetch is best-effort.
  }
}

export function warmHrefs(router: AppRouterInstance, hrefs: readonly string[]) {
  for (const href of hrefs) prefetchHref(router, href);
}

export function usePrefetchOnIntent() {
  const router = useRouter();
  return {
    prefetch: (href: string) => prefetchHref(router, href),
    warm: (hrefs: readonly string[]) => warmHrefs(router, hrefs),
  };
}

/** Prefetch destinations on mount and when the tab becomes visible again. */
export function DestinationWarmup({ hrefs }: { hrefs: readonly string[] }) {
  const router = useRouter();
  const key = hrefs.join("\0");

  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      warmHrefs(router, hrefs);
    };
    warm();
    const onVisible = () => {
      if (document.visibilityState === "visible") warm();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // hrefs is compared via key so callers can pass inline arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, key]);

  return null;
}
