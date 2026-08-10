export default function MainLoading() {
  return (
    <div className="space-y-6 pt-8 text-[var(--numa-ink)]">
      <div className="space-y-2">
        <p className="text-[1.65rem] font-semibold tracking-[-0.04em]">NUMA</p>
        <p className="text-sm text-[var(--numa-muted)]">Laddar sidan…</p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--numa-border)]"
        aria-hidden
      >
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--numa-accent)]" />
      </div>
      <div className="h-36 rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-[var(--numa-border)]" />
        <div className="h-10 w-52 rounded bg-[var(--numa-border)]" />
        <div className="h-3 w-40 rounded bg-[var(--numa-border)]" />
      </div>
      <a
        href="/installningar"
        className="inline-flex text-sm font-medium text-[var(--numa-accent)]"
      >
        Fastnar det? Laga appen →
      </a>
    </div>
  );
}
