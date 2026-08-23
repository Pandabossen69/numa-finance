export default function ImporteraLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-7"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="numa-skel h-7 w-40 rounded-lg" />
      <div className="space-y-2">
        <div className="numa-skel h-3 w-24 rounded-md" />
        <div className="numa-panel-list">
          <div className="px-4 py-3.5">
            <div className="numa-skel h-4 w-2/3 rounded-md" />
            <div className="numa-skel mt-2 h-3 w-1/3 rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="numa-skel h-3 w-16 rounded-md" />
        <div className="numa-panel-list divide-y divide-[var(--numa-border)]">
          <ImporteraRowSkel />
          <ImporteraRowSkel />
          <ImporteraRowSkel />
        </div>
      </div>
    </div>
  );
}

function ImporteraRowSkel() {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="numa-skel h-4 w-20 rounded-md" />
        <div className="numa-skel h-5 w-16 rounded-md" />
      </div>
      <div className="numa-skel mt-2 h-3 w-28 rounded-md" />
    </div>
  );
}
