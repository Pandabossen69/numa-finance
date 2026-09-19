import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanPiles.tsx", import.meta.url), "utf8");

describe("Sparande empty state and Sätt av från Över", () => {
  it("keeps a calm empty state and a Swedish amount placeholder", () => {
    expect(src).toContain("Sätt av från Över det som inte ska levas upp.");
    expect(src).toContain("Inte ännu");
    expect(src).toContain('placeholder="t.ex. 2 000"');
    expect(src).not.toContain('placeholder="0"');
    expect(src).not.toContain("Inget avsatt än");
  });

  it("shows this month as avsatt and prior months as sparat — never a 30k blob", () => {
    expect(src).toContain("SV.sparaI(monthName)");
    expect(src).toContain("showPriorAsHero ? savingsPriorMinor : savingsThisMonthMinor");
    expect(src).toContain("SV.sparandeAvsatt");
    expect(src).toContain("SV.sparat");
    expect(src).toContain("SV.sattAvFranOver");
    expect(src).toContain("SV.sparandeTotalt");
    expect(src).toContain("Taget från Över och dagsbudgeten");
    expect(src).toContain("Nästa månad syns det som sparat.");
    expect(src).not.toContain("Över på kontona ändras inte");
    expect(src).not.toContain("inte Över");
    expect(src).not.toContain("sänker dagsbudgeten, inte Över");
    expect(src).not.toContain("Avsätt");
    expect(src).not.toContain("SV.vaxer");
  });

  it("previews Över / Kvar / dagsbudget before Uppdatera", () => {
    expect(src).toContain("livePreview");
    expect(src).toContain("Över ${formatPlanFigure(input.overFrom)}");
    expect(src).toContain("Kvar i perioden");
    expect(src).toContain("Dagsbudget");
  });

  it("labels Över with a matching aria heading id", () => {
    expect(src).toContain('aria-labelledby="plan-over-heading"');
    expect(src).toContain('id="plan-over-heading"');
    expect(src).not.toContain("plan-mot-planen-heading");
    expect(src).not.toContain("plan-saldo-heading");
  });
});

describe("Plan cash coverage stack", () => {
  it("leads with Saldo / Kommer in / Kvar att betala / avsatt+sparat / Över", () => {
    expect(src).toContain("SV.saldo");
    expect(src).toContain("SV.kommerIn");
    expect(src).toContain('tone="in"');
    expect(src).toContain('tone="out"');
    expect(src).toContain("SV.kvarAttBetala");
    expect(src).toContain("SV.over");
    expect(src).toContain("cashCoverageHintSv");
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
