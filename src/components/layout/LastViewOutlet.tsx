"use client";

import { useState, type ReactNode } from "react";
import { useNavIntent } from "@/components/layout/NavIntent";
import { primaryTab } from "@/components/layout/nav";
import { isViewLoadingNode } from "@/components/layout/view-hold";

/**
 * Keep the previous *tab* visible while the next tab streams.
 * Drill-in (Mer → Saldo) must not hold the parent list.
 */
export function LastViewOutlet({ children }: { children: ReactNode }) {
  const { pathname, pending } = useNavIntent();
  const loading = isViewLoadingNode(children);
  const destTab = primaryTab(pending?.href ?? pathname);
  const [held, setHeld] = useState<ReactNode>(children);
  const [readyAt, setReadyAt] = useState<string | null>(
    loading ? null : pathname,
  );
  const heldTab = readyAt ? primaryTab(readyAt) : null;
  const leaving = Boolean(pending && pending.fromPath === pathname);
  const crossTab = Boolean(destTab && heldTab && destTab !== heldTab);

  if (!loading && !leaving) {
    if (readyAt !== pathname) {
      setReadyAt(pathname);
      setHeld(children);
    }
    return <div className="numa-view">{children}</div>;
  }

  if (crossTab && readyAt) {
    return (
      <div className="numa-view numa-view-hold" aria-busy="true">
        {held}
      </div>
    );
  }

  return <div className="numa-view">{children}</div>;
}
