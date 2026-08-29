"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

type Placement = { top: number; right: number; direction: "down" | "up" };

const MENU_GAP = 6;
const EDGE_PAD = 12;
const ROW_HEIGHT = 44;
/** Floating dock + FAB overhang, so a menu never opens underneath them. */
const DOCK_CLEARANCE = 104;

/**
 * Row actions in a fixed portal.
 *
 * Plan rows live inside `.numa-panel`, which sets `overflow: hidden` — an
 * absolutely positioned menu was clipped there. A portal also keeps the menu
 * out of the document flow, so opening it cannot shift the row. The menu
 * tracks the button on scroll instead of blocking or jumping the page.
 */
export function OverflowMenu({
  label,
  items,
}: {
  label: string;
  items: OverflowMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastPlacement = useRef<Placement | null>(null);
  const menuId = useId();

  const position = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false);
      return;
    }

    const height = menuRef.current?.offsetHeight ?? items.length * ROW_HEIGHT + 8;
    const roomBelow = window.innerHeight - rect.bottom - MENU_GAP - DOCK_CLEARANCE;
    const roomAbove = rect.top - MENU_GAP - EDGE_PAD;
    const direction: Placement["direction"] =
      roomBelow >= height || roomAbove < height ? "down" : "up";
    const rawTop =
      direction === "down" ? rect.bottom + MENU_GAP : rect.top - height - MENU_GAP;
    const maxTop = Math.max(EDGE_PAD, window.innerHeight - height - EDGE_PAD);
    const next: Placement = {
      top: Math.min(Math.max(EDGE_PAD, rawTop), maxTop),
      right: Math.max(EDGE_PAD, window.innerWidth - rect.right),
      direction,
    };

    const previous = lastPlacement.current;
    if (
      previous &&
      previous.direction === next.direction &&
      Math.abs(previous.top - next.top) < 0.5 &&
      Math.abs(previous.right - next.right) < 0.5
    ) {
      return;
    }
    lastPlacement.current = next;
    setPlacement(next);
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) {
      lastPlacement.current = null;
      setPlacement(null);
      return;
    }
    position();
  }, [open, position]);

  // Second pass once the menu is mounted and its real height is known.
  useLayoutEffect(() => {
    if (!open || !placement) return;
    position();
  }, [open, placement, position]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    function onMove() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        position();
      });
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
  }, [open, position]);

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
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              style={{
                top: placement ? `${placement.top}px` : 0,
                right: placement ? `${placement.right}px` : 0,
                visibility: placement ? "visible" : "hidden",
              }}
              className={`numa-overflow-menu fixed z-[70] min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--numa-border)] bg-[var(--numa-card)] py-1 shadow-[var(--numa-shadow)] ${
                placement?.direction === "up" ? "is-up" : ""
              }`}
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
