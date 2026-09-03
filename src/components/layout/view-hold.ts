import { Fragment, isValidElement, type ReactNode } from "react";
import {
  AnalysViewLoading,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";

export function shouldHoldPreviousView(input: {
  loading: boolean;
  leaving: boolean;
  destTab: string | null;
  heldTab: string | null;
}): boolean {
  return resolveVisibleTab({
    ...input,
    destIsTabRoot: true,
    hasDestCache: false,
  }) === "held";
}

/**
 * What to paint while a tab transition is in flight.
 * - dest: destination tab (cached revisit, same-tab refresh, or first visit)
 * - held: previous tab — only as a last resort, never for primary tab switches
 * - children: incoming tree (drill-in, first load, soft fallback)
 *
 * Hem → Plan/Analys/Mer must never keep Hem on screen. The destination
 * comes up immediately: cache on revisit, incoming tree / soft shell otherwise.
 */
export function resolveVisibleTab(input: {
  loading: boolean;
  leaving: boolean;
  destTab: string | null;
  heldTab: string | null;
  destIsTabRoot: boolean;
  hasDestCache: boolean;
}): "dest" | "held" | "children" {
  const inFlight = input.loading || input.leaving;
  if (!inFlight) return "children";
  const crossTab = Boolean(
    input.destTab && input.heldTab && input.destTab !== input.heldTab,
  );
  if (!crossTab) {
    // router.refresh() on Plan/Hem still swaps in loading.tsx. Keep the live tab.
    if (input.loading && input.destIsTabRoot && input.hasDestCache) return "dest";
    return "children";
  }
  // Cross-tab: always the destination. Holding Hem while Plan streams is the
  // "menyn fastnar" bug — Mer/Fota pages are Suspense trees, so a hold never
  // released.
  if (input.destIsTabRoot) return "dest";
  return "children";
}

/**
 * True only for a dedicated route loading shell (loading.tsx), not a real
 * page that happens to contain Suspense, a skeleton, or "Laddar…".
 * Recursing the tree treated Mer (always <Suspense>) as loading forever.
 */
export function isViewLoadingNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some(isViewLoadingNode);
  if (!isValidElement(node)) return false;
  if (
    node.type === ViewLoading ||
    node.type === AnalysViewLoading ||
    node.type === HomeViewLoading
  ) {
    return true;
  }
  const props = node.props as {
    "data-numa-view-loading"?: unknown;
    children?: ReactNode;
  };
  if (
    props["data-numa-view-loading"] === true ||
    props["data-numa-view-loading"] === "true"
  ) {
    return true;
  }
  if (node.type === Fragment) {
    return isViewLoadingNode(props.children);
  }
  return false;
}
