import nextDynamic from "next/dynamic";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";

export const dynamic = "force-dynamic";

const AnalysDashboard = nextDynamic(() =>
  import("@/components/analys/AnalysDashboard").then((mod) => mod.AnalysDashboard),
);

export default async function AnalysPage() {
  const result = await loadAnalysSnapshot();
  return (
    <AnalysDashboard
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
