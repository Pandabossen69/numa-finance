import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanEditor.tsx", import.meta.url), "utf8");

describe("Plan dates and add-form", () => {
  it("labels Intäkter and Fasta utgifter with the same Swedish short date", () => {
    expect(src).toContain("formatListDateSv(item.nextDueAt, timeZone)");
    expect(src).toContain("labelIncomeDateSv");
    expect(src).not.toContain("labelDayOfMonthSv");
  });

  it("shows Plan date inputs as Swedish calendar dates, not US mm/dd/yyyy", () => {
    expect(src).toContain("PlanDateField");
    expect(src).toContain("formatIsoDateOnlySv");
    expect(src).toContain('lang="sv-SE"');
    expect(src).toContain("ÅÅÅÅ-MM-DD");
  });

  it("opens the picker from the native date input so a calendar tap can commit", () => {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(src).toContain('className="numa-date-input"');
    expect(src).toContain("commitCalendarDate");
    expect(src).toContain("PlanDateField");
    expect(src).not.toContain("onPointerDown");
    expect(src).not.toContain("event.preventDefault");
    expect(src).not.toContain("preventDefault()");
    expect(src).not.toContain("openNativeDatePicker");
    expect(src).not.toContain("showPicker");
    expect(src).not.toContain("absolute inset-0 cursor-pointer opacity-0");
    expect(css).toContain(".numa-date-input");
    expect(css).not.toContain("::-webkit-calendar-picker-indicator");
    const dateCss = css.slice(
      css.indexOf(".numa-date-input"),
      css.indexOf(".numa-overflow-menu"),
    );
    expect(dateCss).not.toContain("pointer-events: none");
    expect(css).toContain(".numa-expand.is-open");
    expect(css).toContain("overflow: visible");
  });

  it("scrolls the submit row into view and pads above the FAB when adding", () => {
    expect(src).toContain("scrollIntoView");
    expect(src).toContain('block: "nearest"');
    expect(src).toContain(
      "pb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)+1.75rem)] md:pb-0",
    );
    expect(src).toContain("scroll-mb-[calc(var(--numa-nav-bar)+var(--numa-fab-overhang)");
    expect(src).toContain("md:scroll-mb-0");
  });

  it("does not keep the add toggle over the fields while they expand", () => {
    expect(src).toContain("fieldsMounted");
    expect(src).toContain("const showFields = open || fieldsMounted");
    expect(src).toContain("onTransitionEnd");
  });

  it("keeps month context and fades the chip strip only when it overflows", () => {
    expect(src).toContain("rememberPlanView");
    expect(src).toContain("lastPlanView");
    expect(src).toContain("MonthChipStrip");
    expect(src).toContain("is-overflow-start");
    expect(src).not.toContain("numa-month-strip -mx-1");
  });

  it("opens the matching add form when Kom igång sends steg", () => {
    expect(src).toContain("focusAdd");
    expect(src).toContain("stepHint");
    expect(src).toContain("scrollOnOpen");
    expect(src).toContain('banner={focusAdd === "income" ? stepHint : null}');
    expect(src).toContain("setAddKind(focusAdd)");
  });

  it("computes Över from cash coverage, not Mot planen leftover", () => {
    expect(src).toContain("projectCashCoverage");
    expect(src).toContain("ledgerTransactions");
    expect(src).toContain("coverage={coverage}");
  });

  it("lets every month mark Klar on incomes and expenses without deleting", () => {
    expect(src).toContain("setPlanItemSettledAction");
    expect(src).toContain("onSettle={settleRow}");
    expect(src).toContain("SV.klar");
    expect(src).toContain("SV.angraKlar");
    expect(src).not.toContain("locked={isPastMonth}");
  });

  it("hides the Klar button and shows settled rows with a green wash", () => {
    expect(src).toContain("numa-plan-row");
    expect(src).toContain("is-settled");
    expect(src).toContain("is-partial");
    expect(src).not.toContain("numa-chip numa-chip-mint");
    expect(src).not.toContain("onClick={() => onSettle(item.id, true)}");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".numa-plan-row.is-settled");
    expect(css).toContain("rgba(12, 125, 104");
  });

  it("shows 51 000 − 22 000 = 29 000 and keeps Summa on remaining cash", () => {
    expect(src).toContain("planRowHeroMinor");
    expect(src).toContain("planPartialBreakdown");
    expect(src).toContain("previewPartialRemaining");
    expect(src).toContain("PlanEquation");
    expect(src).toContain("coverage.incomingMinor");
    expect(src).toContain("coverage.unpaidMinor");
    expect(src).toContain("sumCountsTowardCashMinor");
  });

  it("uses a calendar date on new and existing incomes and expenses", () => {
    expect(src).not.toContain('editExtraType="day"');
    expect(src).not.toContain('extraType="day"');
    expect(src).toContain("expenseDate");
    expect(src).not.toContain("Låst — passerad månad");
    expect(src).toContain("createPlanItemAction");
  });

  it("lets Delvis klar take an amount and a date for the rest", () => {
    expect(src).toContain("SV.delvisKlar");
    expect(src).toContain("remainingDatePrompt");
    expect(src).toContain("När kommer resten?");
    expect(src).toContain("När ska resten betalas?");
    expect(src).toContain("partialDate");
    expect(src).toContain("remainingDate");
    expect(src).toContain("applyPlanItemEdits");
    expect(src).toContain("remainingDueIso(item)");
  });
});
