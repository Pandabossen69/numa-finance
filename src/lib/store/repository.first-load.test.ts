import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repo = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

describe("empty new-user snapshot", () => {
  it("returns the empty snapshot before plan, progress, or transactions", () => {
    expect(repo).toContain("emptyTodaySnapshot");
    expect(repo).toContain("accounts.length === 0");
    expect(repo).toContain("void ensurePlanDuesRolled()");
    expect(repo).not.toMatch(
      /void ensurePlanDuesRolled\(\);\s*await api\(\)\.getProfile\(\)/,
    );
  });
});
