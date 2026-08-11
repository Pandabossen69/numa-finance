/**
 * Soft loading — thin top progress only.
 * Avoid big skeleton flash that feels like a full reload between menus.
 */
export default function MainLoading() {
  return (
    <div
      className="relative min-h-[40vh]"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] overflow-hidden bg-transparent">
        <div className="numa-nav-progress h-full w-1/3 rounded-full bg-[var(--numa-accent)]" />
      </div>
      <div className="animate-pulse space-y-5 pt-2 opacity-[0.35]">
        <div className="h-7 w-28 rounded-lg bg-[var(--numa-bg-deep)]" />
        <div className="h-12 w-48 max-w-full rounded-xl bg-[var(--numa-bg-deep)]" />
        <div className="h-24 rounded-[1.35rem] bg-[var(--numa-bg-deep)]" />
      </div>
    </div>
  );
}
