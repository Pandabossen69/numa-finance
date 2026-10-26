export function MovementsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-4"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Rörelser"
    >
      <header>
        <div className="numa-skel h-8 w-36" />
      </header>
      <div className="numa-equal-chips numa-segment">
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-11 shrink-0 rounded-full" />
      </div>
      <div className="numa-panel-list divide-y divide-[var(--numa-border)]">
        <div className="px-4 py-3.5">
          <div className="numa-skel h-4 w-2/3" />
          <div className="numa-skel mt-2 h-3 w-1/3" />
        </div>
        <div className="px-4 py-3.5">
          <div className="numa-skel h-4 w-1/2" />
          <div className="numa-skel mt-2 h-3 w-1/4" />
        </div>
        <div className="px-4 py-3.5">
          <div className="numa-skel h-4 w-3/5" />
          <div className="numa-skel mt-2 h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}
