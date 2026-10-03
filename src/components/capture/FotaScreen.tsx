"use client";

import { useSyncExternalStore } from "react";
import { ReceiptCaptureFlow } from "@/lib/route-islands";
import { FotaPending } from "@/components/capture/FotaViewLoading";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import type { CapturePreview } from "@/features/imports/capture-preview";
import type { CaptureMode } from "@/features/imports/capture-resume";
import { manualAccountsFromSources } from "@/features/finance/manual-accounts";
import {
  lastAccountsSnapshot,
  lastFotaBoot,
  lastHomeSnapshot,
  rememberFotaBoot,
  subscribeAccountsSnapshot,
  subscribeHomeSnapshot,
  type FotaBootSnapshot,
} from "@/features/home/last-snapshot";
import { serverNull } from "@/lib/react/server-snapshot";

/**
 * Mer→Fota calm pending without setState-in-effect:
 * - cold / soft-fallback: data=null → last-known boot or titled FotaPending
 * - island load: route-islands `loading: () => <FotaPending />`
 * - loading.tsx: FotaScreen data={null} via LoadingSlot
 */
export function FotaScreen({
  data,
  error,
  initialMode = "pick",
  initialPreview = null,
  observationId = null,
}: {
  data: FotaBootSnapshot | null;
  error?: string | null;
  initialMode?: CaptureMode;
  initialPreview?: CapturePreview | null;
  observationId?: string | null;
}) {
  // Same Konton snapshot Hem and kvittogranskning already subscribe to.
  // The boot stub is only «Konto» until this list arrives — including after
  // the first paint.
  const knownAccounts = useSyncExternalStore(
    subscribeAccountsSnapshot,
    lastAccountsSnapshot,
    serverNull,
  );
  const homeSnap = useSyncExternalStore(
    subscribeHomeSnapshot,
    lastHomeSnapshot,
    serverNull,
  );
  if (data) rememberFotaBoot(data);
  const view = data ?? lastFotaBoot() ?? fotaBootFromHome(homeSnap);

  if (!view) {
    if (error) {
      return (
        <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Lägg till</h1>
          <p className="text-sm text-[var(--numa-danger)]">{error}</p>
          <RetryLoadButton />
        </div>
      );
    }
    return <FotaPending />;
  }

  const accounts = manualAccountsFromSources({
    shell: view.accounts,
    known: knownAccounts?.accounts,
  });

  return (
    <ReceiptCaptureFlow
      key={
        observationId ? `obs:${observationId}` : `mode:${initialMode}`
      }
      accountId={view.accountId ?? accounts[0]?.id ?? null}
      accounts={accounts}
      remainingTodayMinor={view.remainingTodayMinor}
      currency={view.currency}
      bootstrapping={view.bootstrapping}
      initialMode={initialMode}
      initialPreview={initialPreview}
    />
  );
}

function fotaBootFromHome(
  home: ReturnType<typeof lastHomeSnapshot>,
): FotaBootSnapshot | null {
  if (!home) return null;
  return {
    accountId: home.primaryAccountId,
    accounts: home.primaryAccountId
      ? [
          {
            id: home.primaryAccountId,
            name: "Konto",
            accountType: "checking",
            currency: home.currency,
          },
        ]
      : [],
    remainingTodayMinor: home.remainingTodayMinor,
    currency: home.currency,
    bootstrapping: !home.hasBankTruth,
  };
}
