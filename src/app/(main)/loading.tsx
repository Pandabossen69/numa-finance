export default function MainLoading() {
  return (
    <div className="space-y-4 py-6" aria-busy="true" aria-label="Laddar">
      <div className="h-8 w-40 rounded-lg bg-[var(--numa-bg-deep)]" />
      <div className="h-4 w-64 max-w-full rounded-lg bg-[var(--numa-bg-deep)]" />
      <div className="mt-6 h-40 rounded-[1.5rem] bg-[var(--numa-bg-deep)]" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-[1.35rem] bg-[var(--numa-bg-deep)]" />
        <div className="h-24 rounded-[1.35rem] bg-[var(--numa-bg-deep)]" />
        <div className="h-24 rounded-[1.35rem] bg-[var(--numa-bg-deep)]" />
      </div>
    </div>
  );
}
