"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  addMonthsKey,
  labelMonthChipSv,
  labelMonthNameSv,
  labelMonthSv,
  visibleMonthKeysForYear,
  yearFromMonthKey,
} from "@/domain/finance";

export type MonthDots = { living?: boolean; save?: boolean };

/**
 * One year+month control for Plan and Analys.
 *
 * The selected month is the title — not a chip that can scroll off a
 * 390px strip. Year lives in the same picker, so there is no second
 * control competing with the months.
 */
export function PlanMonthNav({
  monthKey,
  viewYear,
  currentMonthKey,
  onSelectMonth,
  dotsFor,
  idPrefix = "plan",
}: {
  monthKey: string;
  viewYear: number;
  currentMonthKey: string;
  onSelectMonth: (key: string) => void;
  dotsFor?: (key: string) => MonthDots;
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [browseYear, setBrowseYear] = useState<number | null>(null);
  const pickerYear = browseYear ?? viewYear;
  const rootRef = useRef<HTMLElement>(null);
  const pickerId = useId();
  const monthKeys = visibleMonthKeysForYear(pickerYear);
  const isCurrent = monthKey === currentMonthKey;
  const title = labelMonthSv(monthKey);

  function closePicker() {
    setOpen(false);
    setBrowseYear(null);
  }

  function togglePicker() {
    setOpen((value) => !value);
    setBrowseYear(null);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setBrowseYear(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setBrowseYear(null);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pickMonth(key: string) {
    onSelectMonth(key);
    closePicker();
  }

  return (
    <nav ref={rootRef} className="numa-month-nav" aria-label="Välj månad">
      <div className="numa-month-nav-bar">
        <button
          type="button"
          onClick={() => onSelectMonth(addMonthsKey(monthKey, -1))}
          className="numa-press numa-month-nav-step"
          aria-label="Föregående månad"
        >
          ‹
        </button>

        <button
          type="button"
          className="numa-press numa-month-nav-current"
          aria-expanded={open}
          aria-controls={pickerId}
          aria-label={`Välj månad, ${title}`}
          onClick={togglePicker}
        >
          <span className="numa-month-nav-kicker">
            {isCurrent ? "Denna månad" : "Visar"}
          </span>
          <span className="numa-month-nav-title">
            <span className="numa-month-nav-month">{labelMonthNameSv(monthKey)}</span>
            <span className="numa-month-nav-year-text">{yearFromMonthKey(monthKey)}</span>
            <i
              className={open ? "numa-month-nav-caret is-open" : "numa-month-nav-caret"}
              aria-hidden
            />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMonth(addMonthsKey(monthKey, 1))}
          className="numa-press numa-month-nav-step"
          aria-label="Nästa månad"
        >
          ›
        </button>
      </div>

      {!isCurrent ? (
        <button
          type="button"
          onClick={() => pickMonth(currentMonthKey)}
          className="numa-press numa-month-nav-jump"
        >
          Denna månad
        </button>
      ) : null}

      <div
        id={pickerId}
        className={`numa-expand${open ? "is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="numa-expand-inner">
          <div className="numa-month-nav-picker">
            <div className="numa-month-nav-year">
              <button
                type="button"
                onClick={() => setBrowseYear((year) => (year ?? viewYear) - 1)}
                className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
                aria-label="Föregående år"
                tabIndex={open ? 0 : -1}
              >
                ← {pickerYear - 1}
              </button>
              <p className="min-w-[3.5rem] text-center text-base font-semibold tracking-tight">
                {pickerYear}
              </p>
              <button
                type="button"
                onClick={() => setBrowseYear((year) => (year ?? viewYear) + 1)}
                className="numa-press min-h-11 rounded-full px-3 text-sm font-medium text-[var(--numa-muted)] hover:bg-[var(--numa-card)]"
                aria-label="Nästa år"
                tabIndex={open ? 0 : -1}
              >
                {pickerYear + 1} →
              </button>
            </div>

            <div className="numa-month-nav-grid">
              {monthKeys.map((key) => {
                const dots = dotsFor?.(key) ?? {};
                const selected = monthKey === key;
                const current = key === currentMonthKey;
                return (
                  <button
                    key={key}
                    type="button"
                    id={`${idPrefix}-month-${key}`}
                    aria-pressed={selected}
                    onClick={() => pickMonth(key)}
                    className={`numa-press numa-month-nav-cell${
                      selected ? "is-active" : current ? "is-now" : ""
                    }`}
                    aria-label={labelMonthNameSv(key)}
                    tabIndex={open ? 0 : -1}
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
            </div>

            <p className="numa-month-nav-hint">
              Bläddra bakåt och framåt — historik ändras inte
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
