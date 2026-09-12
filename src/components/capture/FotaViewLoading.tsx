/** Calm Fota pending — titled Laddar…, never an empty dark mint shell. */
export function FotaViewLoading() {
  return (
    <div
      className="numa-page numa-page-wide space-y-3 pt-1"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Fota"
    >
      <h1 className="text-3xl font-semibold tracking-tight">Fota</h1>
      <p className="text-sm font-medium text-[var(--numa-muted)]">Laddar…</p>
      <div className="numa-skel h-2.5 w-36 !rounded-full" />
      <div className="numa-skel h-2.5 w-24 !rounded-full" />
    </div>
  );
}

/** Alias used by soft-nav / island loading — same calm shell. */
export const FotaPending = FotaViewLoading;
