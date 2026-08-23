"use client";

import { useState, type ReactNode } from "react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { isViewLoadingNode } from "@/components/layout/view-hold";

/**
 * Keep the previous tab visible while the next segment streams.
 * Same-path refresh stays on live children so Plan does not remount.
 */
export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const leaving = Boolean(pending && pending.fromPath === pathname);
  const [held, setHeld] = useState<ReactNode>(children);
  const [readyAt, setReadyAt] = useState<string | null>(
    loading || leaving ? null : pathname,
  );

  if (!loading && !leaving) {
    if (readyAt !== pathname) {
      setReadyAt(pathname);
      setHeld(children);
    }
    return <div className="numa-view">{children}</div>;
  }

  if (readyAt) {
    return (
      <div className="numa-view numa-view-hold" aria-busy="true">
        {held}
      </div>
    );
  }

  return <div className="numa-view">{children}</div>;
}
