"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Edges = { start: boolean; end: boolean };

function snapScrollLeft(el: HTMLElement) {
  const chips = Array.from(el.children) as HTMLElement[];
  if (chips.length === 0) return;
  const x = el.scrollLeft;
  let best = 0;
  let bestDist = Infinity;
  for (const chip of chips) {
    const left = chip.offsetLeft;
    const dist = Math.abs(left - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = left;
    }
  }
  if (Math.abs(el.scrollLeft - best) > 1) {
    el.scrollLeft = best;
  }
}

/** Hide pills that aren't fully inside the scroller — no mid-glyph slivers. */
function hidePartialChips(el: HTMLElement) {
  if (el.clientWidth < 8) return;
  const box = el.getBoundingClientRect();
  if (box.width < 8) return;
  const active = el.querySelector(
    ".numa-month-chip.is-active",
  ) as HTMLElement | null;
  if (active) {
    const ar = active.getBoundingClientRect();
    if (ar.left < box.left - 0.5) {
      el.scrollLeft += ar.left - box.left;
    } else if (ar.right > box.right + 0.5) {
      el.scrollLeft += ar.right - box.right;
    }
  }
  const box2 = el.getBoundingClientRect();
  for (const chip of Array.from(el.children) as HTMLElement[]) {
    const r = chip.getBoundingClientRect();
    const fully =
      r.width > 0 &&
      r.left >= box2.left - 1 &&
      r.right <= box2.right + 1;
    const keep = chip.classList.contains("is-active");
    chip.classList.toggle("is-clipped", !fully && !keep);
  }
}

/**
 * Month chips with reserved ‹/› flex slots (never over glyphs).
 * Scroll snaps to chip edges; partial pills are hidden so labels stay whole.
 */
export function MonthChipStrip({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    function sync() {
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const next: Edges =
        max <= 2
          ? { start: false, end: false }
          : {
              start: el.scrollLeft > 2,
              end: el.scrollLeft < max - 2,
            };
      setEdges((prev) =>
        prev && prev.start === next.start && prev.end === next.end
          ? prev
          : next,
      );
      hidePartialChips(el);
    }

    function onScroll() {
      sync();
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        const el = scrollerRef.current;
        if (!el) return;
        snapScrollLeft(el);
        sync();
      }, 60);
    }

    sync();
    node.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      snapScrollLeft(node);
      sync();
    });
    ro.observe(node);
    return () => {
      node.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, []);

  const start = edges?.start ?? false;
  const end = edges?.end ?? false;
  const overflow = Boolean(edges && (edges.start || edges.end));

  function scrollByChip(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const chips = Array.from(el.children) as HTMLElement[];
    if (chips.length === 0) return;
    const x = el.scrollLeft;
    let current = 0;
    for (let i = 0; i < chips.length; i++) {
      if (chips[i]!.offsetLeft <= x + 2) current = i;
    }
    const next = Math.max(0, Math.min(chips.length - 1, current + dir));
    el.scrollTo({ left: chips[next]!.offsetLeft, behavior: "smooth" });
  }

  return (
    <div
      className={`numa-month-strip-shell${overflow ? " is-overflow" : ""}`}
      data-numa-month-scroll={overflow ? "more" : undefined}
    >
      {overflow ? (
        <button
          type="button"
          className="numa-month-strip-slot is-start"
          aria-label="Föregående månader"
          disabled={!start}
          onClick={() => scrollByChip(-1)}
        >
          {start ? "‹" : null}
        </button>
      ) : null}
      <div className="numa-month-strip-wrap">
        <div ref={scrollerRef} className="numa-month-strip pb-1">
          {children}
        </div>
      </div>
      {overflow ? (
        <button
          type="button"
          className="numa-month-strip-slot is-end"
          aria-label="Nästa månader"
          disabled={!end}
          onClick={() => scrollByChip(1)}
        >
          {end ? "›" : null}
        </button>
      ) : null}
    </div>
  );
}
