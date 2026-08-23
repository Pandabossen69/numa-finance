import { isValidElement, type ReactNode } from "react";
import { ViewLoading } from "@/components/layout/ViewLoading";

export function isViewLoadingNode(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) return node.some(isViewLoadingNode);
  if (!isValidElement(node)) return false;
  if (node.type === ViewLoading) return true;
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
