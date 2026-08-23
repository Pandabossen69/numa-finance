/**
 * Soft page placeholder — mint panels that match Hem/Plan/Analys layout.
 * No pulse (that reads as a reload). Used by loading.tsx and LastViewOutlet.
 */
export function ViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-4"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar"
    >
      <div className="numa-skel h-8 w-36" />
      <div className="numa-skel h-[11.5rem] w-full" />
      <div className="numa-skel h-16 w-full" />
      <div className="numa-skel h-16 w-full" />
    </div>
  );
}

/** Analys-shaped shell so /analys never paints an empty header/gradient. */
export function AnalysViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-6"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Analys"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="numa-skel h-8 w-28" />
        <div className="numa-skel h-8 w-8 rounded-full" />
      </div>
      <div className="flex gap-2">
        <div className="numa-skel h-10 w-[5.5rem] rounded-full" />
        <div className="numa-skel h-10 w-[5.5rem] rounded-full" />
      </div>
      <div className="numa-skel h-[10.5rem] w-full" />
      <div className="space-y-2">
        <div className="numa-skel h-3 w-16" />
        <div className="numa-skel h-36 w-full" />
      </div>
      <div className="numa-skel h-36 w-full" />
    </div>
  );
}
