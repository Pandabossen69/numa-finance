import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Soft Hem jump — no full document reload. */
export function goHomeInstant(router: AppRouterInstance) {
  router.push("/idag");
  router.refresh();
}

export function refreshQuiet(router: AppRouterInstance) {
  router.refresh();
}
