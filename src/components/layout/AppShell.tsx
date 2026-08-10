import { BottomNav } from "@/components/layout/BottomNav";

/**
 * Shell must NOT await finance data. A hung Supabase call here blanked the
 * entire app (nav + page) with a stuck browser progress bar.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="numa-shell relative text-[var(--numa-ink)]">
      <main className="numa-bottom-pad px-5 pt-[max(1.25rem,var(--numa-safe-top))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
