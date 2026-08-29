"use client";

import { formatIsoDateOnlySv } from "@/domain/finance";
import { commitCalendarDate } from "@/components/plan/plan-format";

export function PlanDateField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-h-11 min-w-[9.5rem]">
      <div
        aria-hidden
        className="pointer-events-none flex min-h-11 w-full items-center rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-left text-sm"
      >
        <span className={value ? "font-medium" : "text-[var(--numa-faint)]"}>
          {value ? formatIsoDateOnlySv(value) : "ÅÅÅÅ-MM-DD"}
        </span>
      </div>
      {/*
        Native input is the hit target so iOS and desktop both commit the
        tapped day. Do not stretch ::-webkit-calendar-picker-indicator or
        call preventDefault — those stop Chromium from writing input.value.
      */}
      <input
        type="date"
        lang="sv-SE"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => commitCalendarDate(e.target.value, value, onChange)}
        onInput={(e) =>
          commitCalendarDate((e.target as HTMLInputElement).value, value, onChange)
        }
        className="numa-date-input"
      />
    </div>
  );
}
