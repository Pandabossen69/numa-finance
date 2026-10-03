/** Plan pending — bars only, never 0,00 or an empty «Lägg in lön» list. */
export function PlanViewLoading() {
  return (
    <div
      className="space-y-4"
      data-numa-view-loading="true"
      aria-busy="true"
      aria-label="Laddar Plan"
    >
      <div className="numa-skel h-36 w-full" />
      <div className="numa-skel h-36 w-full" />
      <div className="numa-skel h-28 w-full" />
    </div>
  );
}
