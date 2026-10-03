"use client";

import { invalidateSettledHomeSurfaces } from "@/features/home/invalidate-settled-home";
import {
  adoptMutationFinance,
  lastImporteraRows,
  patchImporteraRow,
} from "@/features/home/last-snapshot";
import {
  pendingBankMailCountAction,
  refreshBankMailSurfacesAction,
} from "@/features/imports/bank-mail-actions";
import { isPendingBankMail } from "@/features/imports/bank-mail-queue";

let pendingCount: number | null = null;
let pendingCountVersion = 0;
const countListeners = new Set<() => void>();

export function bankMailPendingCountSnapshot(): number | null {
  return pendingCount;
}

export function subscribeBankMailPendingCount(listener: () => void) {
  countListeners.add(listener);
  return () => {
    countListeners.delete(listener);
  };
}

export function bankMailPendingCountVersion(): number {
  return pendingCountVersion;
}

export function publishBankMailPendingCount(count: number) {
  pendingCountVersion += 1;
  pendingCount = count;
  for (const listener of countListeners) listener();
}

/**
 * After Bekräfta or Avvisa: drop the queue row, then invalidate and refill
 * the same keep-alive caches a Rörelser void does (Hem, Plan, Konton,
 * Rörelser) via adoptMutationFinance. Analys is gap-filled from that Hem
 * and Plan inside the adopt. Happens before the shell shows Hem again.
 */
export async function refreshAfterBankMailQueueChange(
  observationId: string,
  notes: string,
) {
  patchImporteraRow(observationId, { status: "processed", notes });
  const queued = lastImporteraRows();
  if (queued) {
    publishBankMailPendingCount(
      queued.filter((row) => isPendingBankMail(row)).length,
    );
  }
  invalidateSettledHomeSurfaces();
  const [surfaces, count] = await Promise.all([
    refreshBankMailSurfacesAction(),
    pendingBankMailCountAction(),
  ]);
  if (surfaces.ok) {
    adoptMutationFinance({
      home: surfaces.home,
      plan: surfaces.plan,
      accounts: surfaces.accounts,
      movements: surfaces.movements,
    });
  }
  publishBankMailPendingCount(count);
}
