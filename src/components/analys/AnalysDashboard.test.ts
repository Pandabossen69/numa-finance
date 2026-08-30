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

  it("answers 'what is left' with the same Över as Hem and Plan", () => {
    // One money story: the hero is cash coverage for the browsed month.
    expect(src).toContain("livingMinor={month.coverage.overMinor}");
    expect(src).toContain("livingLabel={SV.over}");
    expect(src).not.toContain("livingLabel={SV.motPlanen}");
    // And the four lines that build it, exactly as Hem shows them.
    expect(src).toContain("CASH_COVERAGE_HINT_SV");
    expect(src).toContain("label={SV.kommerIn}");
    expect(src).toContain("label={SV.kvarAttBetala}");
    expect(src).toContain("amountMinor={month.coverage.saldoMinor}");

    // The plan-vs-spend story stays as exactly one row, explained, so it
    // cannot be mistaken for the cash answer or repeated twice.
    expect(src).toContain("inte kontanter");
    expect(src).not.toContain("label={SV.motPlanen}");
    expect(src.match(/SV\.minusMotPlanen/g) ?? []).toHaveLength(1);
    expect(src).not.toContain("amountMinor={month.livingSaldoMinor}");
    // Sentences the engine already produced but nothing rendered.
    expect(src).toContain("month.monthLeftoverHint ??");
    expect(src).toContain("hint={month.extraSaldoHint}");
    // And no leftover payload for figures the screen no longer shows.
    const monthView = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(monthView).not.toContain("livingSaldoMinor");
    expect(monthView).not.toContain("wealthTotalMinor");

    // Coverage is built by the shared month builder, not re-derived here.
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(monthBuilder).toContain("coverage: projectCashCoverage({");
    expect(src).not.toContain("projectCashCoverage(");
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
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    // Same derivation as the Plan list — not a second reading of the item.
    expect(monthBuilder).toContain("planRowHeroMinor(item)");
    expect(monthBuilder).toContain("planRowView(item).status");
    expect(monthBuilder).toContain("settledMinor: settledAmountMinor(item)");
    expect(monthBuilder).toContain("plannedMinor: item.amountMinor");
    // Every list goes through the one helper, so none can drift back.
    expect(monthBuilder).toContain("export function toAnalysLine(");
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
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(monthBuilder).toContain("remainingMinor: remainingOpenMinor(item)");
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

  it("shows where the month's money went, from the shared split", () => {
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    const movements = readFileSync(
      new URL("../../features/finance/load-movements.ts", import.meta.url),
      "utf8",
    );
    // Rörelser and Analys read the same function, so the split cannot differ.
    expect(loader).toContain("spendingCategoriesByMonthKey({");
    expect(movements).toContain("spendingCategoriesByMonthKey({");
    expect(movements).not.toContain("categoryMap");
    // The section follows the browsed month and compares with the one before.
    expect(src).toContain("view.categoriesByMonthKey[activeMonthKey]");
    expect(src).toContain("addMonthsKey(activeMonthKey, -1)");
    expect(src).toContain("SpendByCategory");
    expect(src).toContain("Per kategori");
    expect(src).toContain("mer");
    expect(src).toContain("mindre");
    // Header and comparison come from the listed rows, so they cannot
    // contradict the categories under them.
    expect(src).toContain("const categorySpentMinor = sumCategories(monthCategories)");
    expect(src).toContain("spentMinor={categorySpentMinor}");
    expect(src).not.toContain("spentMinor={month.spentMinor}");
  });

  it("gives the bridge block the period's own figures", () => {
    // Before payday it used to hold only "På kontot".
    expect(src).toContain('label="Kommande intäkter"');
    expect(src).toContain('label="Kommande utgifter"');
  });

  it("shows the same period figure above the list as in it", () => {
    // Rows used to show the planned amount while the list below counted what
    // is left, so one screen printed 15 800 and 800 under the same word.
    expect(src).toContain("const cycleIncomingMinor = sumRemaining(cycle.incomes)");
    expect(src).toContain("const cycleUnpaidMinor = sumRemaining(cycle.expenses)");
    expect(src).toContain("amountMinor={cycleIncomingMinor}");
    expect(src).toContain("amountMinor={cycleUnpaidMinor}");
    expect(src).not.toContain("amountMinor={cycle.incomeMinor}");
    expect(src).not.toContain("amountMinor={cycle.expenseMinor}");
    // Spenderat i perioden is structurally 0 before the period opens, so the
    // bridge block does not print it.
    expect(src).not.toMatch(/hasSaldo \? \([\s\S]{0,600}spenderatIPerioden/);
  });

  it("ships no figure the screen never renders", () => {
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    for (const dead of [
      "safeToSpendWeekMinor",
      "freeMinor",
      "daysUntilIncome",
      "endInferred",
      "verificationLabel",
      "safeToSpendTodayMinor",
      "monthLabelSv",
    ]) {
      expect(loader, `${dead} is not rendered by Analys`).not.toContain(dead);
    }
  });

  it("scopes Senaste to the tab you are on", () => {
    const loader = readFileSync(
      new URL("../../features/finance/load-analys.ts", import.meta.url),
      "utf8",
    );
    // Månad shows the browsed month, Perioden the running cycle window.
    expect(src).toContain('scope === "month"');
    expect(src).toContain("=== activeMonthKey");
    expect(src).toContain("cycle.startAt");
    expect(src).toContain("cycle.endAt");
    expect(loader).toContain("startAt: cycle.startAt");
    // Unconfirmed rows are not money that moved.
    expect(src).toContain('tx.status !== "confirmed"');
    // The empty line says which window is empty.
    expect(src).toContain("Inga rörelser i perioden");
    expect(src).not.toContain("Inga rörelser ännu");
    // No pre-sliced list on the payload any more.
    expect(loader).not.toContain("recentTransactions");
  });

  it("browses months and shares the month with Plan", () => {
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    // The same nav component Plan uses, so the two cannot look or act different.
    expect(src).toContain("PlanMonthNav");
    expect(src).toContain('idPrefix="analys"');
    // One remembered month for both screens, subscribed rather than read at
    // mount — tabs stay mounted, so a mount-time read would go stale.
    expect(src).toContain("useSyncExternalStore(\n    subscribePlanView,");
    expect(src).toContain("sharedMonth?.monthKey");
    expect(src).toContain("rememberPlanView({ monthKey: key");
    expect(src).not.toContain("setMonthKey");
    const store = readFileSync(
      new URL("../../features/home/last-snapshot.ts", import.meta.url),
      "utf8",
    );
    expect(store).toContain("export function subscribePlanView(");
    expect(store).toContain("emit(planViewListeners)");
    // Browsing recomputes locally with the same pure builder the server used.
    expect(src).toContain("buildAnalysMonth({");
    expect(monthBuilder).toContain("export function buildAnalysMonth(");
    expect(src).toContain("activeMonthKey === view.monthKey");
    // The heading follows the browsed month, not today.
    expect(src).toContain("labelMonthSv(activeMonthKey)");
    expect(src).not.toContain("{view.monthLabelSv}");
  });
});
