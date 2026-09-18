import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AnalysDashboard.tsx", import.meta.url), "utf8");

describe("Analys month result color", () => {
  it("uses clay alarm for Minus mot planen, not destroy red", () => {
    expect(src).toContain('tone={month.monthResultMinor >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/monthResultMinor >= 0 \? "positive" : "danger"/);
  });

  it("answers leftover vs plan without reprinting Hem/Plan Över", () => {
    // Mot planen stays as exactly one row, explained, so it cannot be
    // mistaken for cash on Hem or the Över pile on Plan.
    expect(src).toContain("inte kontanter");
    expect(src).not.toContain("livingLabel={SV.over}");
    expect(src).not.toContain("livingMinor={month.coverage.overMinor}");
    expect(src).not.toContain("CASH_COVERAGE_HINT_SV");
    expect(src).not.toContain("WealthScoreboard");
    expect(src).not.toContain("label={SV.kommerIn}");
    expect(src).not.toContain("label={SV.kvarAttBetala}");
    expect(src).not.toContain("label={SV.motPlanen}");
    expect(src.match(/SV\.minusMotPlanen/g) ?? []).toHaveLength(1);
    expect(src).not.toContain("amountMinor={month.livingSaldoMinor}");
    expect(src).toContain("month.monthLeftoverHint ??");
    const monthView = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(monthView).not.toContain("livingSaldoMinor");
    expect(monthView).not.toContain("wealthTotalMinor");

    // Coverage still comes from the shared month builder, not re-derived here.
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
    expect(src).toContain("wrap={false}");
    expect(src).toContain("overflow-x-hidden");
  });

  it("labels days until next income as idag / N dagar kvar", () => {
    expect(src).toContain("formatDaysUntilSv");
    expect(src).toContain("cycle.nextIncomeLabelSv");
    expect(src).not.toContain('formatCountSv(cycle.daysLeft, "dag", "dagar")');
  });

  it("points plan work to Plan instead of reprinting Mål and Betald lists", () => {
    expect(src).toContain("SV.analysPlanPointer");
    expect(src).not.toContain("Avsätt sparande under Plan");
    expect(src).not.toContain("Lägg till →");
    expect(src).not.toContain("PlanStatusChip");
    expect(src).not.toContain("PlanEquation");
    expect(src).not.toContain('settleKind="income"');
  });

  it("follows Delvis and Betald/Mottagen from Plan in the shared line builder", () => {
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
    expect(monthBuilder).toContain("export function toAnalysLine(");
    expect(loader).not.toMatch(/amountMinor: i\.amountMinor/);
    expect(loader).not.toMatch(/amountMinor: g\.amountMinor/);
  });

  it("does not auto-mark Betald from the ledger", () => {
    expect(src).not.toMatch(/auto-?mark|autoBetald/i);
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(monthBuilder).toContain("status: planRowView(item).status");
    expect(monthBuilder).not.toMatch(/ledger[\s\S]{0,80}Betald/);
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
    expect(src).toContain("AnalysPending");
    expect(src).toContain("lastHomeSnapshot");
    expect(src).not.toContain("AnalysViewLoading");
    expect(src).toContain("onMouseEnter");
    expect(src).toContain("onFocus");
    expect(src).toContain("DestinationWarmup");
    expect(src).toContain("markIntent(\"/transaktioner\")");
    expect(src).toContain("prefetch={false}");
    expect(src).not.toMatch(/href="\/plan"[\s\S]{0,120}prefetch\n/);
  });

  it("answers vart gick pengarna with one Spenderat, then the same split", () => {
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
    // Analys must project native ledger → canonical THB first (same as
    // Spenderat / Rörelser), or foreign-currency expenses silently drop out
    // of the category split and Senaste still shows KR instead of THB.
    expect(loader).toContain("projectLedgerToCanonicalThb(");
    expect(loader).toContain("fxMapFromTodaySnap");
    expect(movements).toContain("projectLedgerToCanonicalThb(");
    expect(loader).toMatch(
      /const ledgerTransactions = projectLedgerToCanonicalThb\(/,
    );
    expect(src).toContain("currency={tx.currency}");
    expect(src).toContain("view.categoriesByMonthKey[activeMonthKey]");
    expect(src).toContain("addMonthsKey(activeMonthKey, -1)");
    expect(src).toContain("spentMinor > 0 && previousSpentMinor > 0");
    expect(src).toContain("spendingCategoriesInWindow({");
    expect(src).toContain("SpendByCategory");
    expect(src).toContain("SV.vartGickPengarna");
    expect(src).toContain("SV.analysCategoryHint");
    expect(src).toContain("SV.analysEmptySpendPeriod");
    expect(src).toContain("SV.analysEmptySpendMonth");
    expect(src).toContain("mer");
    expect(src).toContain("mindre");
    // Hero and comparison come from the listed rows, so they cannot
    // contradict the categories under them (Spec 4: Per kategori vs Spenderat).
    expect(src).toContain("const spentMinor = sumSpendingCategories(categories)");
    expect(src).toContain("spentMinor={isEmpty ? 0 : spentMinor}");
    expect(src).toContain("spentMinor={spentMinor}");
    expect(src).not.toContain("spentMinor={month.spentMinor}");
    expect(src).not.toContain("spentMinor={categorySpentMinor}");
    expect(src).not.toContain("spentMinor={view.cycleSpendingMinor}");
    // The category section must not print a second total under another name.
    expect(src).not.toContain('aria-label="Per kategori"');
    expect(src).not.toMatch(/<h3[^>]*>\s*Per kategori/);
    expect(src).toContain("SV.spenderatIPerioden");
    expect(src).toContain("SV.spenderatIManaden");
  });

  it("does not reprint Hem's day envelope on Analys", () => {
    expect(src).not.toContain("label={SV.kvarIdag}");
    expect(src).not.toContain("label={SV.dagsbudget}");
    expect(src).not.toContain("label={SV.spenderatIdag}");
    expect(src).not.toContain("view.todaySpendingMinor");
    expect(src).not.toContain("cycle.dayBudgetMinor");
    expect(src).not.toContain("cycle.remainingTodayMinor");
  });

  it("keeps bridge kvar from repeating På kontona as a second hero", () => {
    expect(src).toContain("isBridge && !hasSaldo");
    expect(src).toContain('label={isBridge ? "Kvar tills nästa intäkt" : SV.kvarIPerioden}');
    expect(src).not.toContain("amountMinor={view.calculatedBalanceMinor");
    expect(src).not.toContain("label={SV.paKontot}");
    expect(src).not.toContain('label="Kommande intäkter"');
    expect(src).not.toContain("amountMinor={cycle.incomeMinor}");
    expect(src).not.toContain("amountMinor={cycle.expenseMinor}");
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
    expect(src).toContain("isInPayCycleWindow(");
    expect(src).toContain("cycle.startAt");
    expect(src).toContain("cycle.endAt");
    expect(loader).toContain("startAt: cycle.startAt");
    // Unconfirmed rows are not money that moved.
    expect(src).toContain('tx.status !== "confirmed"');
    expect(src).toContain("Inga rörelser i perioden");
    expect(src).not.toContain("Inga rörelser ännu");
    expect(loader).not.toContain("recentTransactions");
  });

  it("browses months and shares the month with Plan", () => {
    const monthBuilder = readFileSync(
      new URL("../../features/finance/analys-month.ts", import.meta.url),
      "utf8",
    );
    expect(src).toContain("PlanMonthNav");
    expect(src).toContain('idPrefix="analys"');
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
    expect(src).toContain("buildAnalysMonth({");
    expect(monthBuilder).toContain("export function buildAnalysMonth(");
    expect(src).toContain("activeMonthKey === view.monthKey");
    expect(src).toContain("labelMonthSv(activeMonthKey)");
    expect(src).not.toContain("{view.monthLabelSv}");
  });

  it("teaches the purpose in the empty states and page hint", () => {
    expect(src).toContain("SV.analysHint");
    expect(src).toContain("SV.hurGarDet");
    expect(src).toContain("SV.analysEmptyPeriod");
  });
});
