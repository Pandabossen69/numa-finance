"use client";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 pt-8 text-[var(--numa-ink)]">
      <p className="text-[1.65rem] font-semibold">NUMA</p>
      <h1 className="text-xl font-semibold tracking-tight">Något gick fel</h1>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Skärmen kunde inte laddas. Det är oftast en tillfällig störning — prova
        igen, eller laga appen om det upprepas.
      </p>
      {error?.digest ? (
        <p className="text-xs text-[var(--numa-faint)]">Kod: {error.digest}</p>
      ) : null}
      <div className="flex flex-col gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white"
        >
          Försök igen
        </button>
        <a
          href="/idag"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
        >
          Ladda Idag
        </a>
        <a
          href="/installningar"
          className="text-center text-sm font-medium text-[var(--numa-accent)]"
        >
          Laga appen →
        </a>
      </div>
    </div>
  );
}
