/** Soft placeholder while a tab streams — no heavy dashboard skeleton. */
export function TabSoftFallback() {
  return (
    <div className="animate-pulse space-y-5 pt-1 opacity-40" aria-busy="true">
      <div className="h-7 w-28 rounded-lg bg-[var(--numa-bg-deep)]" />
      <div className="h-11 w-44 max-w-full rounded-xl bg-[var(--numa-bg-deep)]" />
      <div className="h-20 rounded-[1.35rem] bg-[var(--numa-bg-deep)]" />
    </div>
  );
}
