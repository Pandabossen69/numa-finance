"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SV } from "@/features/copy/labels-sv";

export function FormulaInfo({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (steps.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className={
        open
          ? "relative shrink-0 max-md:flex max-md:w-full max-md:basis-full max-md:flex-col max-md:items-end"
          : "relative shrink-0"
      }
    >
      <button
        type="button"
        className="numa-press numa-tap-icon rounded-full text-[var(--numa-muted)] ring-1 ring-[var(--numa-border)] hover:bg-[var(--numa-card)] hover:text-[var(--numa-ink)]"
        aria-label={SV.saRaknarNuma}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoGlyph />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] p-4 shadow-[var(--numa-shadow)] max-md:relative max-md:right-auto max-md:z-10 max-md:mt-3 max-md:w-full"
        >
          <p className="numa-section-title">{SV.saRaknarNuma}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-snug text-[var(--numa-muted)]">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function InfoGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 7.1v4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="5.15" r="0.85" fill="currentColor" />
    </svg>
  );
}
