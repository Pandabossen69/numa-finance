/** Shared recovery UI when a page fails to load data. */
export function PageLoadError({
  title,
  body = "Ladda om sidan. Om det kvarstår, gå till Inställningar och tryck “Laga appen”.",
}: {
  title: string;
  body?: string;
}) {
  return (
    <div className="space-y-4 pt-6 text-[var(--numa-ink)]">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">{body}</p>
      <div className="flex flex-col gap-2">
        <a
          href="/idag"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
        >
          Till Idag
        </a>
        <a
          href="/installningar"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] px-5 text-sm font-medium"
        >
          Laga appen
        </a>
      </div>
    </div>
  );
}
