import { AnalysRouteClient } from "@/components/analys/AnalysRouteClient";

export const dynamic = "force-dynamic";

/**
 * Client-first Analys. Last-known paints immediately; quiet fetch catches up.
 */
export default function AnalysPage() {
  return <AnalysRouteClient />;
}
