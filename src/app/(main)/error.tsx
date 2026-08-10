"use client";

import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[numa] route error", error);
  }, [error]);

  return (
    <div className="space-y-4 pt-6 text-[var(--numa-ink)]">
      <h1 className="text-2xl font-semibold tracking-tight">Något gick fel</h1>
      <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
        Sidan kunde inte visas. Prova igen — dina data är kvar.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-5 text-sm font-semibold text-white"
        >
          Försök igen
        </button>
        <a
          href="/idag"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--numa-border)] px-5 text-sm font-medium"
        >
          Till Idag
        </a>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-12 items-center justify-center text-sm text-[var(--numa-muted)]"
        >
          Ladda om sidan
        </button>
      </div>
    </div>
  );
}
