export default function MainLoading() {
  return (
    <div className="space-y-4 pt-8 text-[var(--numa-ink)]">
      <p className="text-[1.65rem] font-semibold">NUMA</p>
      <p className="text-sm text-[var(--numa-muted)]">Laddar…</p>
      <a
        href="/installningar"
        className="inline-flex text-sm font-medium text-[var(--numa-accent)]"
      >
        Fastnar det? Laga appen →
      </a>
    </div>
  );
}
