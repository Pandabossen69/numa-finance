import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./load-movements.ts", import.meta.url), "utf8");

describe("loadMovementsSnapshot", () => {
  it("does not pull the full Hem snapshot for Rörelser", () => {
    expect(src).not.toContain("getCachedTodaySnapshot");
    expect(src).not.toMatch(/from ["']@\/features\/finance\/load-home["']/);
    expect(src).not.toContain("getTodaySnapshot");
    expect(src).toContain("listTransactions");
    expect(src).toContain("calculateAccountBalance");
    expect(src).toContain("appliesToSpending");
    expect(src).toContain("appliesToIncome");
  });
});
