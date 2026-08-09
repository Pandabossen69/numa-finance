import { BottomNav } from "@/components/layout/BottomNav";
import { getTodaySnapshot, type TodaySnapshot } from "@/lib/store/repository";

async function loadShellSnapshot(): Promise<
  Pick<TodaySnapshot, "primaryAccount">
> {
  try {
    return await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] failed to load shell snapshot", error);
    return { primaryAccount: null };
  }
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const snapshot = await loadShellSnapshot();

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
