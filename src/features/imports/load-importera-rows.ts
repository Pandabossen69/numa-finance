import { observationIdsWithRemovedMovement } from "@/features/imports/importera-removed";
import type { ImporteraRow } from "@/features/home/last-snapshot";
import {
  listObservationMovementLinks,
  listObservations,
} from "@/lib/store/repository";

/**
 * Fresh queue for Tidigare bilder. Session user only — repository filters
 * `user_id` from the cookie session, never from the caller.
 */
export async function loadImporteraRows(): Promise<ImporteraRow[]> {
  const observations = await listObservations();
  const links = await listObservationMovementLinks(
    observations.map((observation) => observation.id),
  );
  const removed = observationIdsWithRemovedMovement(links);
  return observations.map((observation) => ({
    id: observation.id,
    kind: observation.kind,
    status: observation.status,
    createdAt: observation.createdAt,
    notes: observation.notes,
    institutionHint: observation.institutionHint,
    movementRemoved: removed.has(observation.id),
  }));
}
