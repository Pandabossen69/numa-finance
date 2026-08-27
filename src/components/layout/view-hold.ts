import { isValidElement, Suspense, type ReactNode } from "react";
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
 * - dest: cached destination (revisit or same-tab refresh — keep the view mounted)
 * - held: previous tab (first visit to dest)
 * - children: show the incoming tree (drill-in, first load, soft fallback)
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
  if (input.destIsTabRoot && input.hasDestCache) return "dest";
  return "held";
}

export function isViewLoadingNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some(isViewLoadingNode);
  if (!isValidElement(node)) return false;
  if (node.type === Suspense) return true;
  if (
    node.type === ViewLoading ||
    node.type === AnalysViewLoading ||
    node.type === HomeViewLoading
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
