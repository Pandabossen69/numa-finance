import { Suspense } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { TabSoftFallback } from "@/components/layout/TabSoftFallback";
import { loadHomeSnapshot } from "@/features/finance/load-home";

export const dynamic = "force-dynamic";

export default function IdagPage() {
  return (
    <Suspense fallback={<TabSoftFallback />}>
      <IdagContent />
    </Suspense>
  );
}

async function IdagContent() {
  const result = await loadHomeSnapshot();
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
