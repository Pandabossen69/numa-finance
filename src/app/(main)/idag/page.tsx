import { Suspense } from "react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { HemPending } from "@/components/layout/ViewLoading";
import { loadAccountsSnapshot } from "@/features/finance/load-accounts";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { loadGettingStartedView } from "@/features/getting-started/load";
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
