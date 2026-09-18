import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ONBOARDING_SV } from "./copy";

const src = readFileSync(new URL("./copy.ts", import.meta.url), "utf8");

describe("first-run onboarding copy", () => {
  it("asks one saldo question and points the rest to Hem", () => {
    expect(ONBOARDING_SV.saldoEyebrow).toBe("Kom igång · 1 av 3");
    expect(ONBOARDING_SV.saldoTitle).toMatch(/kontot just nu/);
    expect(ONBOARDING_SV.afterSaldoHint).toMatch(/Hem/);
    expect(ONBOARDING_SV.fotaTitle).toBe("Fota");
    expect(ONBOARDING_SV.fotaHint).toMatch(/Bank-SMS/);
    expect(ONBOARDING_SV.manualTitle).toBe("Skriv själv");
  });

  it("has no leftover plan-tour or skip copy", () => {
    expect(src).not.toContain("skipPlan");
    expect(src).not.toContain("planDone");
    expect(src).not.toContain("Hoppa över");
    expect(src).not.toContain("Fota / skärmdump");
    expect(ONBOARDING_SV).not.toHaveProperty("planTitle");
    expect(ONBOARDING_SV).not.toHaveProperty("addToPlan");
  });
});
