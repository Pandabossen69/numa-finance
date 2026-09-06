import { Suspense } from "react";
import { AnalysDashboard } from "@/lib/route-islands";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";

export const dynamic = "force-dynamic";

export default function AnalysPage() {
  return (
    <Suspense fallback={<AnalysDashboard data={null} />}>
      <AnalysBody />
    </Suspense>
  );
}

async function AnalysBody() {
  const result = await loadAnalysSnapshot();
  return (
    <AnalysDashboard
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
