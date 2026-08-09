export default function IdagLoading() {
  return (
    <div className="space-y-6 pt-2 text-[var(--numa-ink)]">
      <div className="flex items-end justify-between">
        <p className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</p>
        <p className="text-xs text-[var(--numa-faint)]">Laddar idag…</p>
      </div>
      <div className="h-36 rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-14 rounded-[1.25rem] bg-[var(--numa-accent)]/80" />
        <div className="h-14 rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--numa-border)]" />
        <div className="h-10 w-48 rounded bg-[var(--numa-border)]" />
      </div>
    </div>
  );
}
