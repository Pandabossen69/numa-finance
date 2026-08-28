"use client";

import { ReceiptCaptureFlow } from "@/lib/route-islands";
import { FotaViewLoading } from "@/components/capture/FotaViewLoading";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import type { CapturePreview } from "@/features/imports/capture-preview";
import type { CaptureMode } from "@/features/imports/capture-resume";
import {
  lastFotaBoot,
  lastHomeSnapshot,
  rememberFotaBoot,
  type FotaBootSnapshot,
} from "@/features/home/last-snapshot";

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
  if (data) rememberFotaBoot(data);
  const view = data ?? lastFotaBoot() ?? fotaBootFromHome();

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
    return <FotaViewLoading />;
  }

  return (
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-6">
      <ReceiptCaptureFlow
        key={
          observationId
            ? `obs:${observationId}`
            : `mode:${initialMode}`
        }
        accountId={view.accountId}
        accounts={view.accounts}
        remainingTodayMinor={view.remainingTodayMinor}
        currency={view.currency}
        bootstrapping={view.bootstrapping}
        initialMode={initialMode}
        initialPreview={initialPreview}
      />
    </div>
  );
}

function fotaBootFromHome(): FotaBootSnapshot | null {
  const home = lastHomeSnapshot();
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
