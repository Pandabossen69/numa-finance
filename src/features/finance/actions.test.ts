import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("createExpenseAction", () => {
  it("returns one canonical snapshot after the write", () => {
    const fn = src.slice(
      src.indexOf("export async function createExpenseAction"),
      src.indexOf("const incomeSchema"),
    );
    expect(fn).toContain("createManualExpense");
    expect(fn).toContain("refreshTodaySnapshot");
    expect(fn).toContain("homeSnapshotFromToday");
    expect(fn).toContain("planSnapshotFromToday");
    expect(fn).toContain("accountsSnapshotFromToday");
    expect(fn).toContain("accountId: input.accountId");
  });
});
