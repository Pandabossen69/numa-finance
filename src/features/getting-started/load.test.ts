import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = readFileSync(new URL("./load.ts", import.meta.url), "utf8");

describe("getting-started first-load", () => {
  it("does not wait on the Hem ledger snapshot", () => {
    expect(load).not.toContain("getCachedTodaySnapshot");
    expect(load).not.toContain("loadHomeSnapshot");
    expect(load).not.toContain("getTodaySnapshot");
    expect(load).toContain("listPlanItems");
    expect(load).toContain("listAccounts");
    expect(load).toContain("getProfile");
    expect(load).toContain("isNumaAdminEmail");
  });
});
