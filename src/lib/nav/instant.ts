import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type SpaNavigate = (href: string) => boolean;

let spaNavigate: SpaNavigate | null = null;

/**
 * NavIntent registers the keep-alive switch. Saves call this so Hem
 * actually paints — `router.push` alone only moves the App Router URL.
 */
export function bindSpaNavigate(navigate: SpaNavigate | null) {
  spaNavigate = navigate;
}

/**
 * Soft Hem jump after a successful save. Keep the warm router cache
 * (no refresh). SPA tabs own the visible panel via `spaPath`; pushing
 * `/idag` while that path is still `/fota` leaves Fota on screen.
 */
export function goHomeInstant(router: AppRouterInstance) {
  if (spaNavigate?.("/idag")) return;
  router.push("/idag");
}

/**
 * Same-tick Tidigare bilder. router.push waits for the /importera RSC;
 * the keep-alive panel already has the client queue.
 */
export function goImporteraInstant(router: AppRouterInstance) {
  if (spaNavigate?.("/importera")) return;
  router.push("/importera");
}
