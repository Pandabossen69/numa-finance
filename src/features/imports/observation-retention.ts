export const OBSERVATION_RETENTION_DAYS = 30;

export type PurgeableObservation = {
  id: string;
  capturedAt: string;
  storagePath: string | null;
};

export function observationPurgeCutoffIso(
  now: Date,
  maxAgeDays = OBSERVATION_RETENTION_DAYS,
): string {
  return new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Images older than the promised 30 days — storage path must be present. */
export function observationsDueForPurge<T extends PurgeableObservation>(
  rows: readonly T[],
  now: Date,
  maxAgeDays = OBSERVATION_RETENTION_DAYS,
): T[] {
  const cutoffMs = Date.parse(observationPurgeCutoffIso(now, maxAgeDays));
  return rows.filter((row) => {
    if (!row.storagePath) return false;
    const captured = Date.parse(row.capturedAt);
    return Number.isFinite(captured) && captured <= cutoffMs;
  });
}
