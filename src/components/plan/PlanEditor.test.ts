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

  it("scrolls the submit row into view and pads above the FAB when adding", () => {
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("pb-[calc(var(--numa-fab-overhang)+1.25rem)]");
  });

  it("does not pull the month strip into the fade with negative margin", () => {
    expect(src).toContain('className="numa-month-strip pb-1"');
    expect(src).not.toContain("numa-month-strip -mx-1");
  });
});
