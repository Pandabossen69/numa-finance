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

  it("lets users browse earlier months and years without rewriting history", () => {
    expect(src).toContain("visibleMonthKeysForYear");
    expect(src).toContain("shiftYear(-1)");
    expect(src).toContain('aria-label="Föregående år"');
    expect(src).toContain("Bläddra bakåt och framåt — historik ändras inte");
    expect(src).toContain("min-h-11 rounded-full px-3");
    expect(src).not.toContain("även år framåt");
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

  it("lets every month mark Betald or Mottagen without deleting", () => {
    expect(src).toContain("setPlanItemSettledAction");
    expect(src).toContain("onSettle={settleRow}");
    expect(src).toContain("planDoneLabel");
    expect(src).toContain("planPartialLabel");
    expect(src).toContain('settleKind="income"');
    expect(src).toContain('settleKind="expense"');
    expect(src).toContain("SV.angraKlar");
    expect(src).not.toContain("locked={isPastMonth}");
  });

  it("shows Betald/Mottagen in mint and Delvis in clay, without a Klar button", () => {
    expect(src).toContain("numa-plan-row");
    expect(src).toContain("is-settled");
    expect(src).toContain("is-partial");
    expect(src).toContain("numa-chip numa-chip-mint");
    expect(src).toContain("numa-chip numa-chip-spend");
    expect(src).toContain("<button");
    expect(src).toContain('<span className="numa-chip numa-chip-mint self-end">');
    expect(src).toContain("onClick={() => onSettle(item.id, false)}");
    expect(src).not.toContain("onClick={() => onSettle(item.id, true)}");
    expect(src).toContain("numa-plan-list");
    expect(src).toContain("numa-plan-figures");
    expect(src).toContain("wrap={false}");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".numa-plan-row.is-settled");
    expect(css).toContain(".numa-plan-row.is-partial");
    expect(css).toContain("var(--numa-positive)");
    expect(css).toContain("var(--numa-spend)");
  });

  it("puts Betald last, Delvis just above, and lets Ångra undo both", () => {
    expect(src).toContain("sortPlanRowsForList");
    expect(src).toContain("canUndo");
    expect(src).toContain("explicitSettled");
    expect(src).toContain("aria-label={`Ångra ${doneLabel}`}");
    expect(src).toContain("SV.angraKlar");
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

  it("lets Delvis betald / mottagen take an amount and a date for the rest", () => {
    expect(src).toContain("planPartialLabel");
    expect(src).toContain("remainingDatePrompt");
    expect(src).toContain("När kommer resten?");
    expect(src).toContain("När ska resten betalas?");
    expect(src).toContain("partialDate");
    expect(src).toContain("remainingDate");
    expect(src).toContain("applyPlanItemEdits");
    expect(src).toContain("remainingDueIso(item)");
  });

  it("reconciles mutations locally and does not refresh the whole page", () => {
    expect(src).toContain("rememberLivePlan");
    expect(src).toContain("publishItems");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
    expect(src).not.toContain("useRouter");
  });

  it("lands a new row immediately and closes add without emptying the form first", () => {
    expect(src).toContain("function commitAdd");
    expect(src).toContain("setAddKind(null)");
    expect(src).toContain("adoptServerPlanItems");
    expect(src).toContain("is-fresh");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".numa-plan-row.is-fresh");
    expect(css).toContain("numa-row-in");
    const commit = src.slice(
      src.indexOf("function commitAdd"),
      src.indexOf("function settleRow"),
    );
    expect(commit).toContain("setAddKind(null)");
    expect(commit).toContain("runMutation");
    expect(commit.indexOf("setAddKind(null)")).toBeLessThan(
      commit.indexOf("void runMutation"),
    );
    expect(commit).not.toContain("} else {\n                  setAddKind(null);");
  });
});
