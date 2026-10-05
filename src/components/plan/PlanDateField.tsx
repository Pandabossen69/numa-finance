"use client";

import { formatIsoDateOnlySv } from "@/domain/finance";
import { commitCalendarDate } from "@/components/plan/plan-format";

export function PlanDateField({
  value,
  onChange,
  ariaLabel,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Inclusive earliest day, `YYYY-MM-DD` in the user's timezone. */
  min?: string;
  /** Inclusive latest day, `YYYY-MM-DD` in the user's timezone. */
  max?: string;
}) {
  const shown = value;
  return (
    <div className="relative min-h-11 min-w-[9.5rem]">
      <div
        aria-hidden
        className="pointer-events-none flex min-h-11 w-full items-center rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-left text-sm"
        lang="sv-SE"
      >
        <span className={shown ? "font-medium" : "text-[var(--numa-faint)]"}>
          {shown ? formatIsoDateOnlySv(shown) : "ÅÅÅÅ-MM-DD"}
        </span>
      </div>
      {/*
        Native input is the hit target so iOS and desktop both commit the
        tapped day. Do not stretch ::-webkit-calendar-picker-indicator or
        call preventDefault — those stop Chromium from writing input.value.
        lang=sv-SE keeps the picker and the overlay on a Swedish day, never
        a US 09/25/2026 string.
      */}
      <input
        type="date"
        lang="sv-SE"
        value={shown}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => commitCalendarDate(e.target.value, shown, onChange)}
        onInput={(e) =>
          commitCalendarDate((e.target as HTMLInputElement).value, shown, onChange)
        }
        className="numa-date-input"
      />
    </div>
  );
}
