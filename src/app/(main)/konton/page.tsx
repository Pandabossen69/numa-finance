import { Suspense } from "react";
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { loadAccountsSnapshot } from "@/features/finance/load-accounts";

export default function KontonPage() {
  return (
    <Suspense fallback={<AccountsDashboard data={null} />}>
      <KontonBody />
    </Suspense>
  );
}

async function KontonBody() {
  const result = await loadAccountsSnapshot();
  return (
    <AccountsDashboard
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
    />
  );
}
