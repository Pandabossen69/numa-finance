import { Suspense } from "react";
import { ImporteraScreen } from "@/components/mer/ImporteraScreen";
import { listObservations } from "@/lib/store/repository";

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
  return (
    <ImporteraScreen
      data={observations.map((o) => ({
        id: o.id,
        kind: o.kind,
        status: o.status,
        createdAt: o.createdAt,
        notes: o.notes,
      }))}
    />
  );
}
