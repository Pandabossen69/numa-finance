"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  collapseGettingStartedAction,
  completeGettingStartedAction,
  expandGettingStartedAction,
} from "@/features/getting-started/actions";
import {
  gettingStartedProgressLabel,
  type GettingStartedView,
} from "@/features/getting-started/progress";
import {
  lastGettingStarted,
  rememberGettingStarted,
} from "@/features/home/last-snapshot";

export function GettingStartedCard({ view }: { view: GettingStartedView }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!view.collapsed);
  const [hiding, setHiding] = useState(false);

  if (!view.visible) return null;

  function persistCollapsed(collapsed: boolean) {
    if (pending) return;
    setOpen(!collapsed);
    startTransition(async () => {
      await (collapsed ? collapseGettingStartedAction() : expandGettingStartedAction());
    });
  }

  function dismiss() {
    if (pending) return;
    setHiding(true);
    startTransition(async () => {
      const result = await completeGettingStartedAction();
      if (result.ok) {
        const current = lastGettingStarted() ?? view;
        rememberGettingStarted({ ...current, visible: false, allDone: true });
      } else setHiding(false);
    });
  }

  const progress = gettingStartedProgressLabel(view.doneCount, view.total);

  return (
    <section
      className={`numa-panel animate-rise-delay-2 w-full min-w-0 overflow-hidden transition-opacity duration-150 ${
        hiding ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-labelledby="kom-igang-title"
    >
      <div className="flex min-h-11 items-center gap-2 px-3 py-2 md:px-4">
        {open ? (
          <>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
              aria-hidden
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2.5v11M2.5 8h11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <h2
              id="kom-igang-title"
              className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight text-[var(--numa-ink)]"
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
              className="numa-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-[var(--numa-muted)] transition hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-ink)] focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => persistCollapsed(false)}
            className="numa-press flex min-h-11 w-full min-w-0 items-center gap-2 rounded-full px-1 text-left transition hover:text-[var(--numa-accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              className="ml-1 h-2 w-2 shrink-0 rounded-full bg-[var(--numa-accent)]"
              aria-hidden
            />
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
            <ol className="grid grid-cols-1 gap-1.5 border-t border-[var(--numa-border)] p-2 md:grid-cols-3">
              {view.steps.map((step) => (
                <li key={step.id} className="min-w-0">
                  {step.done ? (
                    <div className="flex min-h-14 items-center justify-between gap-3 rounded-[1.15rem] bg-[var(--numa-positive-soft)] px-3 py-3 md:min-h-[5.5rem] md:items-start md:px-4 md:py-4">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tracking-tight text-[var(--numa-positive)]">
                          {step.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-[var(--numa-muted)]">
                          {step.why}
                        </span>
                      </span>
                      <span
                        className="numa-step-check flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--numa-card)] text-sm font-semibold text-[var(--numa-positive)]"
                        aria-hidden
                      >
                        ✓
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={step.href}
                      className="numa-press flex min-h-14 items-center justify-between gap-3 rounded-[1.15rem] px-3 py-3 text-left transition hover:bg-[var(--numa-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:outline-none focus-visible:ring-inset md:min-h-[5.5rem] md:items-start md:px-4 md:py-4"
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
