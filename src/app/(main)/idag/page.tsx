import { HomeDashboard } from "@/components/home/HomeDashboard";
import { loadHomeSnapshot } from "@/features/finance/load-home";

export const dynamic = "force-dynamic";

export default async function IdagPage() {
  const result = await loadHomeSnapshot();
  return (
    <HomeDashboard
      snap={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
