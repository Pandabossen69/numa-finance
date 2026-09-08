import { Suspense } from "react";
import { AnalysDashboard } from "@/components/analys/AnalysDashboard";
import { AnalysPending } from "@/components/layout/ViewLoading";
import { loadAnalysSnapshot } from "@/features/finance/load-analys";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export const dynamic = "force-dynamic";

export default async function AnalysPage() {
  const last = await readLastHomeCookie();
  return (
    <Suspense fallback={<AnalysPending home={last} />}>
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
