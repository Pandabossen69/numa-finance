export function AccountsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Saldo"
    >
      <div className="space-y-3">
        <div className="numa-skel h-5 w-12" />
        <div className="flex items-end justify-between gap-4">
          <div className="numa-skel h-8 w-24" />
          <div className="numa-skel h-4 w-20" />
        </div>
      </div>
      <div className="space-y-6">
        <div className="numa-panel-list">
          <div className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="numa-skel h-4 w-40" />
                <div className="numa-skel h-3 w-28" />
              </div>
              <div className="numa-skel h-6 w-16" />
            </div>
          </div>
          <div className="bg-[var(--numa-bg)]/35 px-4 py-3.5">
            <div className="numa-skel h-3 w-36" />
            <div className="numa-skel mt-2 h-11 w-full" />
            <div className="numa-skel mt-2.5 h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
