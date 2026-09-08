import { Suspense } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemPending } from "@/components/layout/ViewLoading";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { readLastHomeCookie } from "@/features/home/last-home-cookie.server";

export const dynamic = "force-dynamic";

export default async function IdagPage() {
  const last = await readLastHomeCookie();
  return (
    <Suspense
      fallback={
        last ? <HomeDashboard snap={last} error={null} /> : <HemPending />
      }
    >
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
