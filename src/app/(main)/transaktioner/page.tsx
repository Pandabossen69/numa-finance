import { MovementsRouteClient } from "@/components/movements/MovementsRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Rörelser. The old RSC body awaited an unbounded ledger read
 * (Analys → Transaktioner sat ~10s on loading.tsx). Last-known paints now;
 * the bounded fetch catches up quietly.
 */
export default function TransaktionerPage() {
  return <MovementsRouteClient />;
}
