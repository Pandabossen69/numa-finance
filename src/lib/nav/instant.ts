import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Soft Hem jump — keep the warm router cache (no refresh). */
export function goHomeInstant(router: AppRouterInstance) {
  router.push("/idag");
}

export function refreshQuiet(router: AppRouterInstance) {
  router.refresh();
}
