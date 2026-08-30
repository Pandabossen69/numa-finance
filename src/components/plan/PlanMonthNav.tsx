"use client";

import { useEffect, useRef } from "react";
import { labelMonthNameSv, visibleMonthKeysForYear } from "@/domain/finance";
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
    chipRefs.current[monthKey]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
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
              className={`numa-press numa-month-chip min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold capitalize ${
                monthKey === key
                  ? "is-active bg-[var(--numa-ink)] text-[var(--numa-card)] shadow-[var(--numa-pill-shadow)]"
                  : key === currentMonthKey
                    ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)] ring-1 ring-[var(--numa-accent)]/35"
                    : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)] hover:bg-[var(--numa-accent-soft)] hover:text-[var(--numa-accent-ink)]"
              }`}
            >
              {labelMonthNameSv(key)}
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
