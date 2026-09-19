import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanPiles.tsx", import.meta.url), "utf8");

describe("Sparande empty state and Avsätt", () => {
  it("keeps a calm empty state and a Swedish amount placeholder", () => {
    expect(src).toContain("Sätt av det som inte ska levas upp.");
    expect(src).toContain("Inte ännu");
    expect(src).toContain('placeholder="t.ex. 2 000"');
    expect(src).not.toContain('placeholder="0"');
    expect(src).not.toContain("Inget avsatt än");
  });

  it("shows this month as the hero and explains dagsbudget vs Över", () => {
    expect(src).toContain("Spara i {monthName}");
    expect(src).toContain("amountMinor={savingsThisMonthMinor}");
    expect(src).toContain("SV.sparandeKvarHint");
    expect(src).toContain("hasThisMonth ? \"Uppdatera\" : \"Avsätt\"");
    expect(src).toContain("SV.sparandeTotalt");
    expect(src).not.toContain("SV.vaxer");
    expect(src).not.toContain("Över på kontona");
    expect(src).not.toContain("inte Över");
  });

  it("shows the Kvar / dagsbudget one-liner without a tap", () => {
    expect(src).toContain("SV.sparandeKvarHint");
    expect(src).not.toContain("FormulaInfo");
    expect(src).not.toMatch(/details|<dialog|aria-haspopup/);
    const hintBlock = src.slice(
      src.indexOf("amountMinor={savingsThisMonthMinor}"),
      src.indexOf("numa-year-dots"),
    );
    expect(hintBlock).toContain("SV.sparandeKvarHint");
    expect(hintBlock).toContain("Sätt av det som inte ska levas upp.");
  });

  it("labels Över with a matching aria heading id", () => {
    expect(src).toContain('aria-labelledby="plan-over-heading"');
    expect(src).toContain('id="plan-over-heading"');
    expect(src).not.toContain("plan-mot-planen-heading");
    expect(src).not.toContain("plan-saldo-heading");
  });
});

describe("Plan cash coverage stack", () => {
  it("leads with Saldo / Kommer in / Kvar att betala / Över, not Mot planen", () => {
    expect(src).toContain("SV.saldo");
    expect(src).toContain("SV.kommerIn");
    expect(src).toContain('tone="in"');
    expect(src).toContain('tone="out"');
    expect(src).toContain("SV.kvarAttBetala");
    expect(src).toContain("SV.over");
    expect(src).toContain("CASH_COVERAGE_HINT_SV");
    expect(src).toContain("numa-pile-stack");
    expect(src).toContain("<PileLine");
    expect(src).toContain('tone={overOk ? "over" : "short"}');
    expect(src).not.toContain("SV.motPlanen");
    expect(src).not.toContain("monthLivingSaldoMinor");
    expect(src).not.toContain("livingVsPlanHintSv");
    expect(src).not.toContain('size="xs"');
    expect(src).not.toContain("WealthScoreboard");
  });
});
