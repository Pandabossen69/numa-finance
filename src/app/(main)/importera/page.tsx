import { Suspense } from "react";
import { ImporteraScreen } from "@/components/mer/ImporteraScreen";
import { observationIdsWithRemovedMovement } from "@/features/imports/importera-removed";
import {
  listObservationMovementLinks,
  listObservations,
} from "@/lib/store/repository";

export const dynamic = "force-dynamic";

export default function ImporteraPage() {
  return (
    <Suspense fallback={<ImporteraScreen data={null} />}>
      <ImporteraBody />
    </Suspense>
  );
}

async function ImporteraBody() {
  const observations = await listObservations();
  const links = await listObservationMovementLinks(
    observations.map((observation) => observation.id),
  );
  const removed = observationIdsWithRemovedMovement(links);
  return (
    <ImporteraScreen
      data={observations.map((o) => ({
        id: o.id,
        kind: o.kind,
        status: o.status,
        createdAt: o.createdAt,
        notes: o.notes,
        institutionHint: o.institutionHint,
        movementRemoved: removed.has(o.id),
      }))}
    />
  );
}
