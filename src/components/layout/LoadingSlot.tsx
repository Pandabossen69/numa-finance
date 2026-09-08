import type { ReactNode } from "react";

/**
 * Server-rendered host so LastViewOutlet can see a loading slot during SSR.
 * Client-only fallbacks (ViewLoading, HemPending) are module references on
 * the server — `node.type === ViewLoading` is false, so empty .numa-skel
 * cards were painted as live children.
 */
export function LoadingSlot({ children }: { children: ReactNode }) {
  return <div data-numa-view-loading="true">{children}</div>;
}
