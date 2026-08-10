import { BottomNav } from "@/components/layout/BottomNav";

/** Never await finance data here — hung Supabase blanked the whole app. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="numa-shell relative"
      style={{ color: "#132019", minHeight: "100dvh" }}
    >
      <main
        className="numa-bottom-pad px-5 pt-[max(1.25rem,var(--numa-safe-top))]"
        style={{ color: "#132019" }}
      >
        {/* Plain HTML strip — no client boundary that can fail to paint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(19,32,25,0.12)",
          }}
        >
          <a
            href="/idag"
            style={{
              fontSize: "1.2rem",
              fontWeight: 600,
              color: "#132019",
              textDecoration: "none",
            }}
          >
            NUMA
          </a>
          <a
            href="/laga"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#1f6f5b",
              textDecoration: "none",
            }}
          >
            Laga
          </a>
        </div>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
