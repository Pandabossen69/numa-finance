export default function ImporteraLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-6"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="numa-skel h-8 w-40" />
      <div className="numa-panel-list space-y-0 overflow-hidden">
        <div className="numa-skel mx-4 my-3 h-12 w-auto rounded-xl" />
      </div>
      <div className="space-y-2">
        <div className="numa-skel h-3 w-16" />
        <div className="numa-panel-list overflow-hidden">
          <div className="numa-skel mx-4 my-3 h-14 w-auto rounded-xl" />
          <div className="numa-skel mx-4 my-3 h-14 w-auto rounded-xl" />
          <div className="numa-skel mx-4 my-3 h-14 w-auto rounded-xl" />
        </div>
      </div>
    </div>
  );
}
