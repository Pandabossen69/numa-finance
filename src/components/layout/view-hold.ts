import { isValidElement, Suspense, type ReactNode } from "react";
import { MovementsViewLoading } from "@/components/movements/MovementsViewLoading";
import {
  AnalysPending,
  AnalysViewLoading,
  HemPending,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";

export function shouldHoldPreviousView(input: {
  loading: boolean;
  leaving: boolean;
  destTab: string | null;
  heldTab: string | null;
  intentMismatch?: boolean;
  outletStale?: boolean;
}): boolean {
  return resolveVisibleTab({
    ...input,
    destIsTabRoot: true,
    hasDestCache: false,
  }) === "held";
}

/**
 * What to paint while a tab transition is in flight.
 * - dest: cached destination (revisit or same-tab refresh — keep the view mounted)
 * - dest-loading: destination shell immediately — never keep the previous tab
 *   after the URL / last intent has already moved
 * - held: unused for primary tabs (kept for unexpected non-root dest)
 * - children: incoming tree (URL already on dest, drill-in, same-tab fallback)
 */
export function resolveVisibleTab(input: {
  loading: boolean;
  leaving: boolean;
  destTab: string | null;
  heldTab: string | null;
  destIsTabRoot: boolean;
  hasDestCache: boolean;
  intentMismatch?: boolean;
  pathTab?: string | null;
  /**
   * URL already matches dest, but `children` is still the previous page.
   * Next.js updates the pathname before the dest RSC/loading slot arrives.
   */
  outletStale?: boolean;
}): "dest" | "held" | "children" | "dest-loading" {
  const inFlight =
    input.loading ||
    input.leaving ||
    Boolean(input.intentMismatch) ||
    Boolean(input.outletStale);
  if (!inFlight) return "children";

  if (input.intentMismatch && input.destIsTabRoot) {
    return input.hasDestCache ? "dest" : "dest-loading";
  }

  if (input.destTab && input.pathTab && input.destTab === input.pathTab) {
    // URL already matches dest. Next often swaps in loading.tsx here
    // (Analys → Transaktioner sat 10s on a skeleton). Last-known / dest
    // shell must paint — never the loading slot — until dest children
    // actually arrive.
    if ((input.outletStale || input.loading) && input.destIsTabRoot) {
      return input.hasDestCache ? "dest" : "dest-loading";
    }
    return "children";
  }

  const crossTab = Boolean(
    input.destTab && input.heldTab && input.destTab !== input.heldTab,
  );
  if (!crossTab) {
    // router.refresh() on Plan/Hem still swaps in loading.tsx. Keep the live tab.
    if (input.loading && input.destIsTabRoot && input.hasDestCache) return "dest";
    return "children";
  }
  if (!input.destIsTabRoot) return "children";
  if (input.hasDestCache) return "dest";
  return "dest-loading";
}

export function isViewLoadingNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some(isViewLoadingNode);
  if (!isValidElement(node)) return false;
  if (node.type === Suspense) {
    const boundary = node.props as {
      fallback?: ReactNode;
      children?: ReactNode;
    };
    // Route pages are <Suspense fallback={pending}><Body /></Suspense>.
    // Treating every Suspense as loading kept LastViewOutlet on dest-loading
    // after login (last-known wiped) — empty Hem until a remount.
    if (boundary.children != null && !isViewLoadingNode(boundary.children)) {
      return false;
    }
    return (
      isViewLoadingNode(boundary.fallback) ||
      isViewLoadingNode(boundary.children)
    );
  }
  if (
    node.type === ViewLoading ||
    node.type === AnalysViewLoading ||
    node.type === AnalysPending ||
    node.type === HomeViewLoading ||
    node.type === HemPending ||
    node.type === MovementsViewLoading
  ) {
    return true;
  }
  const props = node.props as {
    "data-numa-view-loading"?: unknown;
    "aria-label"?: unknown;
    className?: unknown;
    children?: ReactNode;
  };
  if (
    props["data-numa-view-loading"] === true ||
    props["data-numa-view-loading"] === "true"
  ) {
    return true;
  }
  if (
    typeof props["aria-label"] === "string" &&
    props["aria-label"].startsWith("Laddar")
  ) {
    return true;
  }
  if (
    typeof props.className === "string" &&
    props.className.split(/\s+/).includes("numa-skel")
  ) {
    return true;
  }
  return isViewLoadingNode(props.children);
}
