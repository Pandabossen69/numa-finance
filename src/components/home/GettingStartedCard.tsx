"use client";

import { useState, useTransition } from "react";
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
  const [open, setOpen] = useState(!view.collapsed);
  const [hiding, setHiding] = useState(false);

  if (!view.visible) return null;

  function persistCollapsed(collapsed: boolean) {
    if (pending) return;
    setOpen(!collapsed);
    startTransition(async () => {
      await (collapsed
        ? collapseGettingStartedAction()
        : expandGettingStartedAction());
    });
  }

  function dismiss() {
    if (pending) return;
    setHiding(true);
    startTransition(async () => {
      const result = await completeGettingStartedAction();
      if (result.ok) router.refresh();
      else setHiding(false);
    });
  }

  const progress = gettingStartedProgressLabel(view.doneCount, view.total);

  return (
    <section
      className={`numa-panel-strong numa-komigang-card w-full min-w-0 overflow-hidden transition-opacity duration-200 ${
        hiding ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-labelledby="kom-igang-title"
    >
      <div className="flex min-h-11 items-center gap-2 px-3 py-1 md:px-4">
        {open ? (
          <>
            <h2
              id="kom-igang-title"
              className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight"
            >
              Kom igång
            </h2>
            <p className="shrink-0 text-[12px] font-medium text-[var(--numa-muted)]">
              {view.allDone ? "Klar" : progress}
            </p>
            <button
              type="button"
              disabled={pending}
              aria-label={view.allDone ? "Dölj Kom igång" : "Minimera Kom igång"}
              onClick={() => (view.allDone ? dismiss() : persistCollapsed(true))}
              className="numa-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-[var(--numa-muted)] transition hover:bg-white/80 hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => persistCollapsed(false)}
            className="numa-press flex min-h-11 w-full min-w-0 items-center gap-2 rounded-full px-1 text-left transition hover:text-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
          >
            <span
              id="kom-igang-title"
              className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight"
            >
              Kom igång
            </span>
            <span className="shrink-0 text-[12px] font-medium text-[var(--numa-muted)]">
              {progress}
            </span>
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--numa-muted)]"
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3.5 6 8 10.5 12.5 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className={`numa-komigang-body ${open ? "is-open" : ""}`}>
        <div className="numa-komigang-body-inner">
          {view.allDone ? (
            <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--numa-muted)] md:px-5">
              Saldo, in och ut är på plats.
            </p>
          ) : (
            <ol className="grid grid-cols-1 divide-y divide-[var(--numa-border)] border-t border-[var(--numa-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
              {view.steps.map((step) => (
                <li key={step.id} className="min-w-0">
                  {step.done ? (
                    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 md:min-h-[5.5rem] md:items-start md:px-4 md:py-4">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tracking-tight text-[var(--numa-positive)]">
                          {step.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-[var(--numa-muted)]">
                          {step.why}
                        </span>
                      </span>
                      <span
                        className="numa-step-check flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-positive-soft)] text-sm font-semibold text-[var(--numa-positive)]"
                        aria-hidden
                      >
                        ✓
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={step.href}
                      className="numa-press flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--numa-accent)] md:min-h-[5.5rem] md:items-start md:px-4 md:py-4"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tracking-tight">
                          {step.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-[var(--numa-muted)]">
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
        </div>
      </div>
    </section>
  );
}
