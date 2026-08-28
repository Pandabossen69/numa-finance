export function FotaViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-8"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Fota"
    >
      <div className="space-y-2">
        <div className="numa-skel h-8 w-20" />
        <div className="numa-skel h-4 w-64" />
      </div>
      <div className="grid gap-3">
        <div className="numa-skel h-20 w-full" />
        <div className="numa-skel h-20 w-full" />
        <div className="numa-skel h-20 w-full" />
        <div className="numa-skel h-20 w-full" />
      </div>
    </div>
  );
}
