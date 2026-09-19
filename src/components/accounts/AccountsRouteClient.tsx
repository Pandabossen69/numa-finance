"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { getAccountsSnapshotAction } from "@/features/finance/accounts-snapshot";
import {
  isAccountsDirty,
  lastAccountsSnapshot,
  rememberAccountsSnapshot,
  subscribeAccountsSnapshot,
} from "@/features/home/last-snapshot";

/**
 * Client-first Konton (NextStep quiet-load pattern).
 * Paint last-known immediately; fetch only when the dest shell has nothing.
 * Quiet menu warm owns background fill after Hem — never wipe last-known.
 */
export function AccountsRouteClient() {
  const stored = useSyncExternalStore(
    subscribeAccountsSnapshot,
    lastAccountsSnapshot,
    lastAccountsSnapshot,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Quiet menu warm owns background refresh when cache is warm.
    if (lastAccountsSnapshot()) return;
    void getAccountsSnapshotAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        if (!isAccountsDirty()) rememberAccountsSnapshot(result.data);
        setError(null);
        return;
      }
      if (!lastAccountsSnapshot()) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <AccountsDashboard data={stored} error={error} />;
}
