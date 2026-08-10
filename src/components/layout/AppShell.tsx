import { BlankScreenGuard } from "@/components/layout/BlankScreenGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { ShellSafetyStrip } from "@/components/layout/ShellSafetyStrip";

/** Never await finance data here — hung Supabase blanked the whole app. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="numa-shell relative text-[var(--numa-ink)]"
      style={{ color: "#132019", minHeight: "100dvh" }}
    >
      <BlankScreenGuard />
      <main
        className="numa-bottom-pad px-5 pt-[max(1.25rem,var(--numa-safe-top))]"
        style={{ color: "#132019" }}
      >
        <ShellSafetyStrip />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
