import { BottomNav } from "@/components/layout/BottomNav";
import { getTodaySnapshot, type TodaySnapshot } from "@/lib/store/repository";

async function loadShellSnapshot(): Promise<
  Pick<TodaySnapshot, "primaryAccount" | "accounts">
> {
  try {
    return await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] failed to load shell snapshot", error);
    return { primaryAccount: null, accounts: [] };
  }
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const snapshot = await loadShellSnapshot();
  const accounts = snapshot.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
  }));

  return (
    <div className="numa-shell relative text-[var(--numa-ink)]">
      <main className="numa-bottom-pad px-5 pt-[max(1.25rem,var(--numa-safe-top))]">
        {children}
      </main>
      <BottomNav
        accountId={snapshot.primaryAccount?.id}
        hasAccount={Boolean(snapshot.primaryAccount)}
        accounts={accounts}
      />
    </div>
  );
}
