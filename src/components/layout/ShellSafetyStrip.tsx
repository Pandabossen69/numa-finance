"use client";

/**
 * Always painted above page content. If Idag is blank from a bad cache,
 * this strip still gives a way out.
 */
export function ShellSafetyStrip() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3">
      <a
        href="/idag"
        className="text-[1.35rem] font-semibold tracking-[-0.04em] text-[var(--numa-ink)]"
      >
        NUMA
      </a>
      <a
        href="/installningar?laga=1"
        className="text-xs font-medium text-[var(--numa-accent)]"
      >
        Tom skärm? Laga →
      </a>
    </div>
  );
}
