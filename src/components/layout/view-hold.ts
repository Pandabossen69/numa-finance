import { Fragment, isValidElement, type ReactNode } from "react";
import {
  AnalysViewLoading,
  HomeViewLoading,
  ViewLoading,
} from "@/components/layout/ViewLoading";

export function shouldHoldPreviousView(input: {
  loading: boolean;
  destTab: string | null;
  pathTab: string | null;
}): boolean {
  return resolveVisibleTab({
    ...input,
    destIsTabRoot: true,
    hasDestCache: false,
  }) === "held";
}

/**
 * What to paint while a tab transition is in flight.
 * - dest: last tapped tab (cache, incoming tree, or dest-shaped shell)
 * - children: URL tree (drill-in, first load, same-tab)
 *
 * Latest intent always wins. A slow Analys RSC that commits after the user
 * already tapped Mer must never paint Analys.
 */
export function resolveVisibleTab(input: {
  loading: boolean;
  destTab: string | null;
  pathTab: string | null;
  destIsTabRoot: boolean;
  hasDestCache: boolean;
}): "dest" | "held" | "children" {
  const mismatch = Boolean(
    input.destTab && input.pathTab && input.destTab !== input.pathTab,
  );
  if (mismatch) {
    return input.destIsTabRoot ? "dest" : "children";
  }
  if (input.loading && input.destIsTabRoot && input.hasDestCache) return "dest";
  return "children";
}

/**
 * True only for a dedicated route loading shell (loading.tsx), not a real
 * page that happens to contain Suspense, a skeleton, or "Laddar…".
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
