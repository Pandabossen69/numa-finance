import { Suspense } from "react";
import { HomeDashboard } from "@/lib/route-islands";
import { loadAccountsSnapshot } from "@/features/finance/load-accounts";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { loadGettingStartedView } from "@/features/getting-started/load";

export const dynamic = "force-dynamic";

export default function IdagPage() {
  return (
    <Suspense fallback={<HomeDashboard snap={null} error={null} />}>
      <IdagBody />
    </Suspense>
  );
}

async function IdagBody() {
  const [result, accounts, gettingStarted] = await Promise.all([
    loadHomeSnapshot(),
    loadAccountsSnapshot(),
    loadGettingStartedView(),
  ]);
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
      accounts={accounts.ok ? accounts.data : null}
      gettingStarted={gettingStarted}
    />
  );
}
