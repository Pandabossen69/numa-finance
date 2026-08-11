import { Suspense } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { TabSoftFallback } from "@/components/layout/TabSoftFallback";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";

export const dynamic = "force-dynamic";

export default function AnalysPage() {
  return (
    <Suspense fallback={<TabSoftFallback />}>
      <AnalysContent />
    </Suspense>
  );
}

async function AnalysContent() {
  const result = await loadAnalysSnapshot();
  return (
    <AnalysDashboard
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
