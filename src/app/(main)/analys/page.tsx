import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";

export const dynamic = "force-dynamic";

export default async function AnalysPage() {
  const result = await loadAnalysSnapshot();
  return (
    <AnalysDashboard
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
