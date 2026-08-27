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
    expect(src).toContain("SV.kvarAttBetala");
    expect(src).toContain("SV.over");
    expect(src).toContain("CASH_COVERAGE_HINT_SV");
    expect(src).not.toContain("SV.motPlanen");
    expect(src).not.toContain("monthLivingSaldoMinor");
    expect(src).not.toContain("livingVsPlanHintSv");
  });
});
