export function AccountsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Konton"
    >
      <header className="space-y-3">
        <div className="numa-skel h-4 w-12" />
        <div className="flex items-end justify-between gap-3">
          <h1 className="numa-page-title">Konton</h1>
          <div className="numa-skel h-4 w-20" />
        </div>
      </header>
      <div className="space-y-3" aria-hidden>
        <p className="text-sm font-medium text-[var(--numa-muted)]">Hämtar konton…</p>
        {[0, 1].map((row) => (
          <div key={row} className="numa-panel-list px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="numa-skel h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="numa-skel h-4 w-32" />
                <div className="numa-skel h-3 w-24" />
              </div>
              <div className="numa-skel h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
