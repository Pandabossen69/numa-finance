import { isValidElement, type ReactNode } from "react";
import { AnalysViewLoading, ViewLoading } from "@/components/layout/ViewLoading";

export function shouldHoldPreviousView(input: {
  loading: boolean;
  leaving: boolean;
  destTab: string | null;
  heldTab: string | null;
}): boolean {
  if (!input.loading && !input.leaving) return false;
  return Boolean(input.destTab && input.heldTab && input.destTab !== input.heldTab);
}

export function isViewLoadingNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some(isViewLoadingNode);
  if (!isValidElement(node)) return false;
  if (node.type === ViewLoading || node.type === AnalysViewLoading) return true;
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
  return isViewLoadingNode(props.children);
}
