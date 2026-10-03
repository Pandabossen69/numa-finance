/** Shown in /importera when the linked movement was voided. Read-time only. */
export const MOVEMENT_REMOVED_LABEL = "Rörelsen borttagen";

export type ObservationMovementLink = {
  observationId: string;
  status: string;
};

/**
 * An observation counts as removed only when it has linked movements and
 * every one of them is voided. A live row keeps the saved label.
 */
export function observationIdsWithRemovedMovement(
  links: readonly ObservationMovementLink[],
): Set<string> {
  const byObservation = new Map<string, string[]>();
  for (const link of links) {
    const id = link.observationId.trim();
    if (!id) continue;
    const statuses = byObservation.get(id) ?? [];
    statuses.push(link.status);
    byObservation.set(id, statuses);
  }
  const removed = new Set<string>();
  for (const [id, statuses] of byObservation) {
    if (statuses.length > 0 && statuses.every((status) => status === "voided")) {
      removed.add(id);
    }
  }
  return removed;
}
