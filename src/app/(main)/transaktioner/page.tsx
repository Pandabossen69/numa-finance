import { MovementsScreen } from "@/lib/route-islands";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";

export default async function TransaktionerPage() {
  const result = await loadMovementsSnapshot();
  return (
    <MovementsScreen
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
