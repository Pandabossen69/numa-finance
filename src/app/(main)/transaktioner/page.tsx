import nextDynamic from "next/dynamic";
import { loadMovementsSnapshot } from "@/features/finance/load-movements";

const MovementsScreen = nextDynamic(() =>
  import("@/components/movements/MovementsScreen").then(
    (mod) => mod.MovementsScreen,
  ),
);

export default async function TransaktionerPage() {
  const result = await loadMovementsSnapshot();
  return (
    <MovementsScreen
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
