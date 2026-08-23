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
