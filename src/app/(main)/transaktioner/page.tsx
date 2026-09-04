import { Suspense } from "react";
import { MovementsScreen } from "@/lib/route-islands";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";

export const dynamic = "force-dynamic";

export default function TransaktionerPage() {
  return (
    <Suspense fallback={<MovementsScreen data={null} />}>
      <TransaktionerBody />
    </Suspense>
  );
}

async function TransaktionerBody() {
  const result = await loadMovementsSnapshot();
  return (
    <MovementsScreen
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
