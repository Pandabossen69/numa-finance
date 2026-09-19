import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanMonthNav.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

describe("PlanMonthNav", () => {
  it("is one year+month control with the selected month as the title", () => {
    expect(src).toContain("labelMonthSv(monthKey)");
    expect(src).toContain("labelMonthNameSv(monthKey)");
    expect(src).toContain("numa-month-nav-title");
    expect(src).toContain("numa-month-nav-month");
    expect(src).toContain("numa-month-nav-year-text");
    expect(src).toContain("numa-month-nav-sep");
    expect(src).toContain("Välj månad");
    expect(src).toContain("Denna månad");
    expect(src).toContain("Visar");
    expect(src).toContain("addMonthsKey(monthKey, -1)");
    expect(src).toContain("addMonthsKey(monthKey, 1)");
    expect(src).toContain("onPrefetchMonth");
    expect(src).toContain("onPointerEnter={() => onPrefetchMonth?.(addMonthsKey(monthKey, -1))}");
    expect(src).toContain("onPointerEnter={() => onPrefetchMonth?.(addMonthsKey(monthKey, 1))}");
    expect(src).not.toContain("MonthChipStrip");
    expect(src).not.toContain("onShiftYear");
    expect(src).not.toContain("numa-month-chip");
  });

  it("keeps year stepping inside the same picker, not a second control", () => {
    expect(src).toContain("numa-month-nav-picker");
    expect(src).toContain("numa-month-nav-grid");
    expect(src).toContain("setBrowseYear");
    expect(src).toContain("visibleMonthKeysForYear(pickerYear)");
    expect(src).toContain('aria-label="Föregående år"');
    expect(src).toContain('aria-label="Nästa år"');
    expect(src).toContain("numa-expand");
    expect(src).toContain("aria-expanded={open}");
    expect(src).toContain('event.key === "Escape"');
  });

  it("makes the selected month obvious at phone width", () => {
    const month = css.slice(
      css.indexOf(".numa-month-nav-month {"),
      css.indexOf(".numa-month-nav-year-text {"),
    );
    expect(month).toContain("clamp(1.22rem, 5.6vw, 1.5rem)");
    expect(month).toContain("font-weight: 700");
    expect(css).toContain("grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(css).toContain(".numa-month-nav-cell.is-active");
    expect(css).toContain(".numa-month-nav-cell.is-now");
  });
});
