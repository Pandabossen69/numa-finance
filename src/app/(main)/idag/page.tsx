import { HomeDashboard } from "@/components/home/HomeDashboard";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { loadGettingStartedView } from "@/features/getting-started/load";

export const dynamic = "force-dynamic";

export default async function IdagPage() {
  const [result, gettingStarted] = await Promise.all([
    loadHomeSnapshot(),
    loadGettingStartedView(),
  ]);
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
      gettingStarted={gettingStarted}
    />
  );
}
