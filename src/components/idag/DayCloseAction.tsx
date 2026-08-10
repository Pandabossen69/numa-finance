"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeDayAction } from "@/features/gamification/actions";

export function DayCloseAction({
  alreadyClosedToday,
}: {
  alreadyClosedToday: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closed, setClosed] = useState(alreadyClosedToday);
  const [feedback, setFeedback] = useState<{
    headlineSv: string;
    bodySv: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await closeDayAction();
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setClosed(true);
            setFeedback({ headlineSv: result.headlineSv, bodySv: result.bodySv });
            router.refresh();
          });
        }}
        className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-[var(--numa-border)] bg-transparent text-sm font-medium text-[var(--numa-muted)] transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending
          ? "Sparar dagens läge…"
          : closed
            ? "Dagens läge sparat"
            : "Avsluta dagen"}
      </button>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {feedback ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-accent)_10%,transparent)] px-4 py-3 text-sm leading-relaxed text-[var(--numa-muted)]"
          role="status"
        >
          <span className="font-medium text-[var(--numa-ink)]">
            {feedback.headlineSv}.
          </span>{" "}
          {feedback.bodySv}
        </p>
      ) : null}
    </div>
  );
}
