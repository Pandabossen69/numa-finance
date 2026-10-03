"use client";

import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
import { invalidateSettledHomeSurfaces } from "@/features/home/invalidate-settled-home";
import {
  lastImporteraRows,
  patchImporteraRow,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import { pendingBankMailCountAction } from "@/features/imports/bank-mail-actions";
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
 * After Bekräfta or Avvisa: drop the queue row, invalidate Plan + Hem the
 * same way a Rörelser void does, then refill the snapshot and the counter
 * before the keep-alive Hem panel is shown again.
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
  const [snap, count] = await Promise.all([
    getHomeSnapshotAction(),
    pendingBankMailCountAction(),
  ]);
  if (snap.ok) rememberHomeSnapshot(snap.data, { force: true });
  publishBankMailPendingCount(count);
}
