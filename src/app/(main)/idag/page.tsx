import { Suspense } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemFirstPaint } from "@/components/layout/HemFirstPaint";
import { loadHomeSnapshot } from "@/features/finance/load-home";

export const dynamic = "force-dynamic";

export default function IdagPage() {
  return (
    <Suspense fallback={<HemFirstPaint />}>
      <IdagBody />
    </Suspense>
  );
}

async function IdagBody() {
  // Money only. Extra Hem panels used to hang this Suspense for tens of
  // seconds because those loaders had no timeout. Persist fills them.
  const result = await loadHomeSnapshot();
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
