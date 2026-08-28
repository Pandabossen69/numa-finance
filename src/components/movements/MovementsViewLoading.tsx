export function MovementsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Rörelser"
    >
      <div className="numa-skel h-8 w-36" />
      <div className="flex gap-2">
        <div className="numa-skel h-11 w-[7.5rem] rounded-full" />
        <div className="numa-skel h-11 w-[5.5rem] rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="numa-skel h-24 w-full" />
        <div className="numa-skel h-24 w-full" />
        <div className="numa-skel h-24 w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="numa-skel h-11 w-16 rounded-full" />
        <div className="numa-skel h-11 w-20 rounded-full" />
        <div className="numa-skel h-11 w-20 rounded-full" />
        <div className="numa-skel h-11 w-16 rounded-full" />
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
