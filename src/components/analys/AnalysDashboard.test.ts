import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AnalysDashboard.tsx", import.meta.url), "utf8");

describe("Analys month result color", () => {
  it("shows kvar idag as clay alarm when the day is overspent", () => {
    expect(src).toContain("cycle.remainingTodayMinor < 0");
    expect(src).toContain('? "alarm"');
  });

  it("uses clay alarm for Minus mot planen, not destroy red", () => {
    expect(src).toContain('tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}');
    expect(src).toContain('tone={month.freeToSpendMinor >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/monthResultMinor >= 0 \? "positive" : "danger"/);
    expect(src).not.toMatch(/freeToSpendMinor >= 0 \? "positive" : "danger"/);
  });

  it("labels month leftover as Mot planen, not cash", () => {
    expect(src).toContain("livingLabel={SV.motPlanen}");
    expect(src).toContain("inte kontanter");
  });

  it("restores Perioden/Månad when the dashboard remounts", () => {
    expect(src).toContain("lastAnalysScope");
    expect(src).toContain("rememberAnalysScope");
  });

  it("gives Analys scope chips a 44px tap target", () => {
    expect(src).toContain("min-h-11");
    expect(src).not.toContain("min-h-10");
  });

  it("keeps Perioden/Månad as equal chips and money on one line", () => {
    expect(src).toContain("numa-equal-chips");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("numa-money-stack");
    expect(src).toContain("numa-hero-money");
    expect(src).toContain("numa-analys-wealth");
    expect(src).toContain("wrap={false}");
    expect(src).toContain("overflow-x-hidden");
  });

  it("labels days until next income as idag / N dagar kvar", () => {
    expect(src).toContain("formatDaysUntilSv");
    expect(src).toContain("cycle.nextIncomeLabelSv");
    expect(src).not.toContain('formatCountSv(cycle.daysLeft, "dag", "dagar")');
  });

  it("does not send empty Mål to a dead Lägg till on Plan", () => {
    expect(src).toContain("Avsätt sparande under Plan");
    expect(src).not.toContain("Lägg till →");
  });

  it("follows Delvis and Betald/Mottagen from Plan", () => {
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    // Same derivation as the Plan list — not a second reading of the item.
    expect(loader).toContain("planRowHeroMinor(item)");
    expect(loader).toContain("planRowView(item).status");
    expect(loader).toContain("settledMinor: settledAmountMinor(item)");
    expect(loader).toContain("plannedMinor: item.amountMinor");
    // Every list goes through the one helper, so none can drift back.
    expect(loader).toContain("function toAnalysLine(");
    expect(loader).not.toMatch(/amountMinor: i\.amountMinor/);
    expect(loader).not.toMatch(/amountMinor: g\.amountMinor/);

    // The screen renders the same chip and the same Delvis equation as Plan.
    expect(src).toContain("planChipLabel");
    expect(src).toContain("planChipClass");
    expect(src).toContain("PlanStatusChip");
    expect(src).toContain("PlanEquation");
    expect(src).toContain('settleKind="income"');
    expect(src).toContain('settleKind="expense"');
  });

  it("totals a list the same way Plan's Summa does — what is left", () => {
    expect(src).toContain(
      "const totalMinor = lines.reduce((sum, line) => sum + line.remainingMinor, 0)",
    );
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    expect(loader).toContain("remainingMinor: remainingOpenMinor(item)");
    // No caller can hand the list a total that contradicts its rows.
    expect(src).not.toContain("totalMinor={cycle.incomeMinor}");
    expect(src).not.toContain("totalMinor={cycle.expenseMinor}");
    expect(src).not.toContain("totalMinor={month.incomeMinor}");
    expect(src).not.toContain("totalMinor={month.expenseMinor}");
  });

  it("keeps the last Analys block clear of the floating dock", () => {
    expect(src).toContain("pb-10");
    expect(src).toContain("pb-8");
    expect(src).not.toContain("space-y-3 pb-2");
  });

  it("lets the Analys header wrap so the formula panel can sit above the tabs", () => {
    expect(src).toContain("flex flex-wrap items-start justify-between");
  });

  it("shows last-known Analys while a remount has no snapshot", () => {
    expect(src).toContain("lastAnalysSnapshot");
    expect(src).toContain("rememberAnalysSnapshot");
    expect(src).toContain("AnalysViewLoading");
    expect(src).toContain("onMouseEnter");
    expect(src).toContain("onFocus");
    expect(src).toContain("DestinationWarmup");
  });
});
