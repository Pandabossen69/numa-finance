"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

const MENU_GAP = 6;
const EDGE_PAD = 12;
/** Floating dock + FAB overhang, so a menu never opens underneath them. */
const DOCK_CLEARANCE = 104;

/**
 * Row actions in a fixed portal.
 *
 * Plan rows live inside `.numa-panel`, which sets `overflow: hidden` — an
 * absolutely positioned menu was clipped there. A portal also keeps the menu
 * out of the document flow, so opening it cannot shift the row.
 *
 * Placement is written straight to the node instead of held in state: the menu
 * needs its own measured height to decide whether to flip up, and going
 * through state would mean rendering twice and re-running effects on scroll.
 */
export function OverflowMenu({
  label,
  items,
}: {
  label: string;
  items: OverflowMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const place = useCallback((onAnchorLost?: () => void) => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;

    const rect = button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      onAnchorLost?.();
      return;
    }

    const height = menu.offsetHeight;
    const roomBelow = window.innerHeight - rect.bottom - MENU_GAP - DOCK_CLEARANCE;
    const roomAbove = rect.top - MENU_GAP - EDGE_PAD;
    const up = roomBelow < height && roomAbove >= height;
    const rawTop = up ? rect.top - height - MENU_GAP : rect.bottom + MENU_GAP;
    const maxTop = Math.max(EDGE_PAD, window.innerHeight - height - EDGE_PAD);

    menu.style.top = `${Math.min(Math.max(EDGE_PAD, rawTop), maxTop)}px`;
    menu.style.right = `${Math.max(EDGE_PAD, window.innerWidth - rect.right)}px`;
    menu.classList.toggle("is-up", up);
    menu.style.visibility = "visible";
  }, []);

  // The user just tapped the button, so the anchor is on screen here.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const close = () => setOpen(false);
    function onMove() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place(close);
      });
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
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
      {/* `open` only turns true from a click, so this never runs on the server. */}
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              style={{ top: 0, right: 0, visibility: "hidden" }}
              className="numa-overflow-menu fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] py-1 shadow-[var(--numa-shadow)]"
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
