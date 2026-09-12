"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

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

/**
 * Horizontal chip strip with reserved ‹/› flex slots (never over glyphs).
 * Partial pills get `is-clipped` via React className. Overflow defaults true
 * so phone widths never flash a mid-glyph before measure.
 */
export function ChipStrip({
  children,
  startLabel,
  endLabel,
  activeSelector,
}: {
  children: ReactNode;
  startLabel: string;
  endLabel: string;
  /** Keep this chip fully in view when present (e.g. ".numa-month-chip.is-active"). */
  activeSelector?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: true });
  const [overflow, setOverflow] = useState(true);
  /** Indices of chips that are not fully inside the scroller. */
  const [clipped, setClipped] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const shell = shellRef.current;
    if (!scroller || !shell) return;

    let raf = 0;
    /** Content-geometry signature of the active chip. We only auto-scroll when
     *  selection/size changes — never fight ‹/› or touch scroll. */
    let lastActiveSig = "";

    function ensureActiveVisible(el: HTMLElement) {
      if (!activeSelector) return;
      const active = el.querySelector(activeSelector) as HTMLElement | null;
      if (!active) {
        lastActiveSig = "";
        return;
      }
      const sig = `${active.textContent ?? ""}:${active.offsetLeft}:${active.offsetWidth}`;
      const viewLeft = el.scrollLeft;
      const viewRight = viewLeft + el.clientWidth;
      const aLeft = active.offsetLeft;
      const aRight = aLeft + active.offsetWidth;
      const out = aLeft < viewLeft - 0.5 || aRight > viewRight + 0.5;
      // Same chip geometry: user may have scrolled it away — leave them be.
      if (sig === lastActiveSig) return;
      lastActiveSig = sig;
      if (!out) return;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      if (aLeft < viewLeft - 0.5) el.scrollLeft = Math.max(0, aLeft);
      else el.scrollLeft = Math.min(max, Math.max(0, aRight - el.clientWidth));
    }

    function readClipped(el: HTMLElement): Set<number> {
      const next = new Set<number>();
      if (el.clientWidth < 8) return next;

      // Prefer offset/scroll geometry — getBoundingClientRect was racing
      // keep-alive / slot layout and leaving mid-glyphs unmarked.
      ensureActiveVisible(el);

      const left = el.scrollLeft;
      const right = left + el.clientWidth;
      const chips = Array.from(el.children) as HTMLElement[];
      chips.forEach((chip, i) => {
        const chipLeft = chip.offsetLeft;
        const chipRight = chipLeft + chip.offsetWidth;
        const fully =
          chip.offsetWidth > 0 &&
          chipLeft >= left - 0.75 &&
          chipRight <= right + 0.75;
        if (!fully) next.add(i);
      });
      return next;
    }

    function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }

    function measure() {
      const el = scrollerRef.current;
      if (!el) return;
      if (el.clientWidth < 8) return;

      const max = el.scrollWidth - el.clientWidth;
      const hasOverflow = max > 2;
      const nextEdges: Edges = hasOverflow
        ? { start: el.scrollLeft > 2, end: el.scrollLeft < max - 2 }
        : { start: false, end: false };

      setOverflow(hasOverflow);
      setEdges((prev) =>
        prev.start === nextEdges.start && prev.end === nextEdges.end
          ? prev
          : nextEdges,
      );

      const nextClipped = readClipped(el);
      el.dataset.clippedDebug = String(nextClipped.size);
      setClipped((prev) => (sameSet(prev, nextClipped) ? prev : nextClipped));
    }

    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }

    measure();
    schedule();
    const t1 = window.setTimeout(measure, 0);
    const t2 = window.setTimeout(measure, 50);
    const t3 = window.setTimeout(measure, 200);
    void document.fonts?.ready?.then(measure);

    function onScroll() {
      measure();
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        const el = scrollerRef.current;
        if (!el) return;
        snapScrollLeft(el);
        measure();
      }, 60);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    ro.observe(shell);
    for (const child of Array.from(scroller.children)) ro.observe(child);

    const spaPanel = shell.closest("[data-numa-spa-tab]");
    const mo = spaPanel ? new MutationObserver(schedule) : null;
    if (spaPanel && mo) {
      mo.observe(spaPanel, {
        attributes: true,
        attributeFilter: ["hidden", "data-numa-spa-visible"],
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo?.disconnect();
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, [activeSelector]);

  function scrollByChip(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const chips = Array.from(el.children) as HTMLElement[];
    if (chips.length === 0) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const x = el.scrollLeft;
    const viewRight = x + el.clientWidth;

    if (dir === 1) {
      // Bring the first chip that spills past the right edge fully into view
      // (works for natural-width category pills, not only equal month cells).
      for (const chip of chips) {
        const right = chip.offsetLeft + chip.offsetWidth;
        if (right > viewRight + 0.75) {
          el.scrollTo({
            left: Math.min(max, Math.max(0, right - el.clientWidth)),
            behavior: "smooth",
          });
          return;
        }
      }
      el.scrollTo({ left: max, behavior: "smooth" });
      return;
    }

    for (let i = chips.length - 1; i >= 0; i--) {
      const chip = chips[i]!;
      if (chip.offsetLeft < x - 0.75) {
        el.scrollTo({ left: Math.max(0, chip.offsetLeft), behavior: "smooth" });
        return;
      }
    }
    el.scrollTo({ left: 0, behavior: "smooth" });
  }

  const painted = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ className?: string }>;
    const prev = el.props.className ?? "";
    const isClipped = clipped.has(index);
    const className = isClipped
      ? `${prev} is-clipped`.trim()
      : prev.replace(/\bis-clipped\b/g, "").trim();
    return cloneElement(el, { className });
  });

  return (
    <div
      ref={shellRef}
      className={`numa-month-strip-shell${overflow ? " is-overflow" : ""}`}
      data-numa-month-scroll={overflow ? "more" : undefined}
      data-numa-strip="slots-v3"
      data-clipped-count={clipped.size}
    >
      {overflow ? (
        <button
          type="button"
          className="numa-month-strip-slot is-start"
          aria-label={startLabel}
          disabled={!edges.start}
          onClick={() => scrollByChip(-1)}
        >
          {edges.start ? "‹" : null}
        </button>
      ) : null}
      <div className="numa-month-strip-wrap">
        <div ref={scrollerRef} className="numa-month-strip pb-1">
          {painted}
        </div>
      </div>
      {overflow ? (
        <button
          type="button"
          className="numa-month-strip-slot is-end"
          aria-label={endLabel}
          disabled={!edges.end}
          onClick={() => scrollByChip(1)}
        >
          {edges.end ? "›" : null}
        </button>
      ) : null}
    </div>
  );
}
