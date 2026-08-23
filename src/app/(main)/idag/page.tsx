import { Suspense } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HomeViewLoading } from "@/components/layout/ViewLoading";
import { loadHomeSnapshot } from "@/features/finance/load-home";

export const dynamic = "force-dynamic";

export default function IdagPage() {
  return (
    <Suspense fallback={<HomeViewLoading />}>
      <IdagBody />
    </Suspense>
  );
}

async function IdagBody() {
  const result = await loadHomeSnapshot();
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
