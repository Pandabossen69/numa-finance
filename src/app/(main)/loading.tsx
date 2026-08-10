export default function MainLoading() {
  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <div className="flex items-end justify-between">
        <p className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</p>
        <p className="text-xs text-[var(--numa-faint)]">Laddar…</p>
      </div>
      <div className="h-36 rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--numa-border)]" />
        <div className="h-10 w-52 rounded bg-[var(--numa-border)]" />
        <div className="h-3 w-40 rounded bg-[var(--numa-border)]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
        <div className="h-20 rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      </div>
    </div>
  );
}
