export function MovementsViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Rörelser"
    >
      <header>
        <div className="numa-skel h-8 w-36" />
      </header>
      <div className="numa-equal-chips">
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel col-span-2 h-11 w-full rounded-full" />
      </div>
      <section className="numa-panel-strong numa-stat-trio p-5" aria-hidden>
        <StatSkel />
        <StatSkel />
        <StatSkel />
      </section>
      <section className="numa-money-stack" aria-hidden>
        <div className="numa-row">
          <div className="numa-skel h-5 w-24" />
          <div className="numa-skel h-5 w-20" />
        </div>
      </section>
      <div className="numa-equal-chips numa-rorelser-filters is-quad">
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-full rounded-full" />
        <div className="numa-skel h-11 w-full rounded-full" />
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

function StatSkel() {
  return (
    <div className="min-w-0">
      <p className="numa-section-title">
        <span className="numa-skel block h-[0.92rem] w-16" />
      </p>
      <div className="numa-hero-money mt-2">
        <span className="numa-skel block h-6 w-24" />
      </div>
    </div>
  );
}
