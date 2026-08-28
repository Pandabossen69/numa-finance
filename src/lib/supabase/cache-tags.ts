/** Shared tag for Hem / Plan / Analys snapshot rows (schema `numa`). */
export const NUMA_MENU_SNAPSHOT_TAG = "numa-menu-snapshot";

export function numaMenuSnapshotTag(userId: string): string {
  return `${NUMA_MENU_SNAPSHOT_TAG}:${userId}`;
}
