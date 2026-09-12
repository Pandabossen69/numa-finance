"use client";

import { useEffect, useRef } from "react";
import { labelMonthChipSv, labelMonthNameSv, visibleMonthKeysForYear } from "@/domain/finance";
import { MonthChipStrip } from "@/components/plan/MonthChipStrip";

export type MonthDots = { living?: boolean; save?: boolean };

/**
 * Year stepper + month chips, shared by Plan and Analys.
 *
 * Both screens read and write the same remembered month, so switching tabs
 * keeps you in the month you were looking at instead of snapping back to today.
 */
export function PlanMonthNav({
  monthKey,
  viewYear,
  currentMonthKey,
  onSelectMonth,
  onShiftYear,
  dotsFor,
  idPrefix = "plan",
}: {
  monthKey: string;
  viewYear: number;
  currentMonthKey: string;
  onSelectMonth: (key: string) => void;
  onShiftYear: (delta: number) => void;
  dotsFor?: (key: string) => MonthDots;
  idPrefix?: string;
}) {
  const monthKeys = visibleMonthKeysForYear(viewYear);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const chip = chipRefs.current[monthKey];
    const strip = chip?.closest(".numa-month-strip") as HTMLElement | null;
    if (!chip || !strip) return;
    // Clamp to max so Dec sits in a full 5-chip window — never a mid-glyph.
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const left = Math.min(Math.max(0, chip.offsetLeft), max);
    strip.scrollTo({ left, behavior: "smooth" });
  }, [monthKey, viewYear]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShiftYear(-1)}
            className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
            aria-label="Föregående år"
          >
            ← {viewYear - 1}
          </button>
          <p className="min-w-[3.5rem] text-center text-base font-semibold tracking-tight">
            {viewYear}
          </p>
          <button
            type="button"
            onClick={() => onShiftYear(1)}
            className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
            aria-label="Nästa år"
          >
            {viewYear + 1} →
          </button>
        </div>
        {monthKey !== currentMonthKey ? (
          <button
            type="button"
            onClick={() => onSelectMonth(currentMonthKey)}
            className="numa-press text-sm font-semibold text-[var(--numa-accent)]"
          >
            Denna månad
          </button>
        ) : (
          <p className="text-xs font-medium text-[var(--numa-faint)]">
            Bläddra bakåt och framåt — historik ändras inte
          </p>
        )}
      </div>

      <MonthChipStrip>
        {monthKeys.map((key) => {
          const dots = dotsFor?.(key) ?? {};
          return (
            <button
              key={key}
              type="button"
              id={`${idPrefix}-month-${key}`}
              ref={(el) => {
                chipRefs.current[key] = el;
              }}
              onClick={() => onSelectMonth(key)}
              className={`numa-press numa-month-chip min-h-11 rounded-full text-sm font-semibold normal-case ${
                monthKey === key
                  ? "is-active bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
                  : key === currentMonthKey
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)] ring-1 ring-[var(--numa-accent)]/35"
                    : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-accent-ink)]"
              }`}
              aria-label={labelMonthNameSv(key)}
            >
              {labelMonthChipSv(key)}
              {dots.living || dots.save ? (
                <span className="numa-month-dots" aria-hidden>
                  {dots.living ? <i className="is-saldo" /> : null}
                  {dots.save ? <i className="is-save" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </MonthChipStrip>
    </div>
  );
}
