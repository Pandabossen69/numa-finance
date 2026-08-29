"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function MonthChipStrip({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    function sync() {
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 2) {
        setOverflow({ start: false, end: false });
        return;
      }
      setOverflow({
        start: el.scrollLeft > 2,
        end: el.scrollLeft < max - 2,
      });
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

  const fade =
    overflow.start && overflow.end
      ? "is-overflow-start is-overflow-end"
      : overflow.start
        ? "is-overflow-start"
        : overflow.end
          ? "is-overflow-end"
          : "";

  return (
    <div ref={scrollerRef} className={`numa-month-strip pb-1 ${fade}`.trim()}>
      {children}
    </div>
  );
}
