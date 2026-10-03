"use server";

import { observationIdsWithRemovedMovement } from "@/features/imports/importera-removed";
import type { ImporteraRow } from "@/features/home/last-snapshot";
import {
  listObservationMovementLinks,
  listObservations,
} from "@/lib/store/repository";

/**
 * Fresh queue for the client store. Not part of the /importera RSC, so the
 * 30s segment cache cannot replay a pre-confirm list. No revalidatePath.
 */
export async function loadImporteraRowsAction(): Promise<ImporteraRow[]> {
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
