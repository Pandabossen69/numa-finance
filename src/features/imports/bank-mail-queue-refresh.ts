"use client";

import { invalidateSettledHomeSurfaces } from "@/features/home/invalidate-settled-home";
import {
  adoptMutationFinance,
  invalidateAnalysSnapshot,
  lastImporteraRows,
  patchImporteraRow,
  persistPendingBankMailCount,
} from "@/features/home/last-snapshot";
import { refreshBankMailSurfacesAction } from "@/features/imports/bank-mail-actions";
import {
  bankMailPendingCountVersion,
  publishBankMailPendingCount as publishCount,
} from "@/features/imports/bank-mail-pending-store";
import { readPendingBankMailCount } from "@/lib/numa/read-client";
import { isPendingBankMail } from "@/features/imports/bank-mail-queue";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

export {
  bankMailPendingCountSnapshot,
  bankMailPendingCountVersion,
  seedBankMailPendingCount,
  subscribeBankMailPendingCount,
} from "@/features/imports/bank-mail-pending-store";

export function publishBankMailPendingCount(count: number) {
  publishCount(count);
  persistPendingBankMailCount(count);
}

/** Stale Hem read must not overwrite a confirm or reject that already published. */
export function publishBankMailPendingCountIfCurrent(
  seenVersion: number,
  count: number,
): boolean {
  if (bankMailPendingCountVersion() !== seenVersion) return false;
  publishBankMailPendingCount(count);
  return true;
}

let surfacesStale = false;

/** Next SPA navigation refetches when the background refill failed. */
export function retryBankMailSurfacesIfStale() {
  if (!surfacesStale) return;
  surfacesStale = false;
  invalidateSettledHomeSurfaces();
  invalidateAnalysSnapshot();
  scheduleQuietMenuWarm({ restart: true });
}

function markBankMailSurfacesStale(error: unknown) {
  surfacesStale = true;
  console.error("[numa] bank-mail.refresh", error);
}

/**
 * After Bekräfta or Avvisa: drop the queue row immediately, then refill
 * Hem, Plan, Konton and Rörelser in the background. Callers must not wait
 * on the returned promise before the ack — the toast and Hem jump stay in
 * the same turn as insert OK. Analys is gap-filled from that Hem and Plan
 * inside adoptMutationFinance when the refill lands.
 */
export async function refreshAfterBankMailQueueChange(
  observationId: string,
  notes: string,
): Promise<{ ok: boolean }> {
  patchImporteraRow(observationId, { status: "processed", notes });
  const queued = lastImporteraRows();
  if (queued) {
    publishBankMailPendingCount(
      queued.filter((row) => isPendingBankMail(row)).length,
    );
  }
  invalidateSettledHomeSurfaces();
  try {
    const [surfaces, count] = await Promise.all([
      refreshBankMailSurfacesAction(),
      readPendingBankMailCount().catch(() => null),
    ]);
    if (!surfaces.ok) {
      markBankMailSurfacesStale("Bakgrundsrefresh misslyckades");
      return { ok: false };
    }
    adoptMutationFinance({
      home: surfaces.home,
      plan: surfaces.plan,
      accounts: surfaces.accounts,
      movements: surfaces.movements,
    });
    if (count?.ok) publishBankMailPendingCount(count.count);
    surfacesStale = false;
    return { ok: true };
  } catch (error) {
    markBankMailSurfacesStale(error);
    return { ok: false };
  }
}
