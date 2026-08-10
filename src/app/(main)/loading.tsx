export default function MainLoading() {
  return (
    <div className="space-y-4 pt-2 text-[var(--numa-ink)]">
      <h2 className="text-2xl font-semibold tracking-tight">Laddar…</h2>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Hämtar ditt läge. Om det stannar här: laga appen.
      </p>
      <div className="h-28 rounded-[1.75rem] border border-[var(--numa-border)] bg-[var(--numa-surface)]" />
      <a
        href="/installningar?laga=1"
        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-4 text-sm font-semibold text-white"
      >
        Laga appen nu
      </a>
    </div>
  );
}
