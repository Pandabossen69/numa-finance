"use client";

import { useEffect, useId, useRef, useState } from "react";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export function OverflowMenu({
  label,
  items,
}: {
  label: string;
  items: OverflowMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="numa-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden className="text-lg font-semibold leading-none">
          ⋯
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="numa-overflow-menu absolute right-0 z-30 mt-1 min-w-[10rem] overflow-hidden rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] py-1 shadow-[var(--numa-shadow-sm)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`numa-press flex min-h-11 w-full items-center px-3.5 text-left text-sm font-semibold disabled:opacity-45 ${
                item.tone === "danger"
                  ? "text-[var(--numa-danger)] hover:bg-[var(--numa-danger-soft)]/70"
                  : "text-[var(--numa-ink)] hover:bg-[var(--numa-bg)]"
              }`}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
