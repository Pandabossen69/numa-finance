/** Shell (nav/header) stays; avoid a pulse skeleton that feels like a reload. */
export function TabSoftFallback() {
  return <div className="min-h-[24vh]" aria-busy="true" aria-label="Laddar" />;
}
