"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collapseGettingStartedAction,
  completeGettingStartedAction,
  expandGettingStartedAction,
} from "@/features/getting-started/actions";
import {
  gettingStartedProgressLabel,
  type GettingStartedView,
} from "@/features/getting-started/progress";

export function GettingStartedCard({ view }: { view: GettingStartedView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!view.visible) return null;

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    if (pending) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
    });
  }

  if (view.collapsed && !view.allDone) {
    return (
      <div className="flex justify-start md:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(expandGettingStartedAction)}
          className="numa-press inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--numa-accent-soft)] px-4 text-sm font-semibold text-[var(--numa-accent-ink)] shadow-[var(--numa-shadow-sm)] transition hover:bg-[var(--numa-accent)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--numa-accent)]"
        >
          Kom igång
          <span className="text-[12px] font-medium opacity-80">
            {gettingStartedProgressLabel(view.doneCount, view.total)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <section
      className="numa-panel-strong numa-komigang-card mx-auto w-full max-w-xl space-y-4 p-5 md:mx-0 md:p-6"
      aria-labelledby="kom-igang-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="numa-section-title">Kom igång</p>
          <h2
            id="kom-igang-title"
            className="mt-1 text-lg font-semibold tracking-tight"
          >
            {view.allDone
              ? "Klar"
              : gettingStartedProgressLabel(view.doneCount, view.total)}
          </h2>
        </div>
        <button
          type="button"
          disabled={pending}
          aria-label={view.allDone ? "Dölj Kom igång" : "Minimera Kom igång"}
          onClick={() =>
            run(
              view.allDone
                ? completeGettingStartedAction
                : collapseGettingStartedAction,
            )
          }
          className="numa-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-[var(--numa-muted)] transition hover:bg-white/80 hover:text-[var(--numa-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--numa-accent)]"
        >
          ×
        </button>
      </div>

      {view.allDone ? (
        <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
          Saldo, in och ut är på plats.
        </p>
      ) : (
        <ol className="divide-y divide-[var(--numa-border)] border-y border-[var(--numa-border)]">
          {view.steps.map((step) => (
            <li key={step.id}>
              {step.done ? (
                <div className="flex min-h-14 items-center justify-between gap-3 py-3">
                  <span>
                    <span className="block text-sm font-semibold tracking-tight text-[var(--numa-positive)]">
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-[var(--numa-muted)]">
                      {step.why}
                    </span>
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-positive-soft)] text-sm font-semibold text-[var(--numa-positive)]"
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
              ) : (
                <Link
                  href={step.href}
                  className="numa-press flex min-h-14 items-center justify-between gap-3 py-3 text-left transition hover:text-[var(--numa-accent-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--numa-accent)]"
                >
                  <span>
                    <span className="block text-sm font-semibold tracking-tight">
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-[var(--numa-muted)]">
                      {step.why}
                    </span>
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-sm font-semibold text-[var(--numa-accent-ink)]"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
