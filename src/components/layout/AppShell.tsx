import { BottomNav } from "@/components/layout/BottomNav";
import { getTodaySnapshot } from "@/lib/store/repository";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const snapshot = await getTodaySnapshot();

  return (
    <div className="numa-shell relative">
      <main className="numa-bottom-pad px-5 pt-[max(1.25rem,var(--numa-safe-top))]">
        {children}
      </main>
      <BottomNav
        accountId={snapshot.primaryAccount?.id}
        hasAccount={Boolean(snapshot.primaryAccount)}
      />
    </div>
  );
}
