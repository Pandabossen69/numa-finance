"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Edges = { start: boolean; end: boolean };

/**
 * Horizontal month chips. Edge ‹/› only after layout proves overflow, and
 * only on the side that still has more — never mid-glyph fades over labels.
 */
export function MonthChipStrip({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** null until first measure — avoids ‹/› flicker on mount/select. */
  const [edges, setEdges] = useState<Edges | null>(null);

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
    }

    sync();
    node.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => {
      node.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  const start = edges?.start ?? false;
  const end = edges?.end ?? false;
  const fade =
    start && end
      ? "is-overflow-start is-overflow-end"
      : start
        ? "is-overflow-start"
        : end
          ? "is-overflow-end"
          : "";

  return (
    <div
      className={`numa-month-strip-wrap ${fade}`.trim()}
      data-numa-month-scroll={start || end ? "more" : undefined}
    >
      {start ? (
        <span className="numa-month-strip-chevron is-start" aria-hidden>
          ‹
        </span>
      ) : null}
      {end ? (
        <span className="numa-month-strip-chevron is-end" aria-hidden>
          ›
        </span>
      ) : null}
      <div ref={scrollerRef} className="numa-month-strip pb-1">
        {children}
      </div>
    </div>
  );
}
