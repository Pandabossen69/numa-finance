"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { getAccountsSnapshotAction } from "@/features/finance/accounts-snapshot";
import {
  isAccountsDirty,
  paintableAccountsSnapshot,
  rememberAccountsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Client-first Konton (NextStep quiet-load pattern).
 * Paint last-known immediately only when it agrees with Hem «På kontona»
 * and is not missing fresher account ids. Stale last-known skips paint
 * (shell) and fetches immediately so soft-nav matches a hard reload.
 */
export function AccountsRouteClient() {
  const stored = useSyncExternalStore(
    subscribeAccountsSnapshot,
    paintableAccountsSnapshot,
    paintableAccountsSnapshot,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (paintableAccountsSnapshot()) return;
    void getAccountsSnapshotAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        if (!isAccountsDirty()) rememberAccountsSnapshot(result.data);
        setError(null);
        return;
      }
      if (!paintableAccountsSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);

  return <AccountsDashboard data={stored} error={error} />;
}
