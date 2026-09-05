import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./load-account-detail.ts", import.meta.url), "utf8");
const load = readFileSync(new URL("./load-accounts.ts", import.meta.url), "utf8");

describe("loadAccountDetail", () => {
  it("loads one account through the user-scoped getAccount", () => {
    expect(src).toContain("getAccount(accountId)");
    expect(src).toContain("notFound: true");
    expect(src).toContain("accountHasLedgerHistory");
    expect(src).toContain("listAccounts()");
  });
});

describe("loadAccountsSnapshot archived split", () => {
  it("keeps archived accounts out of the active list and Hem total", () => {
    expect(load).toContain("listArchivedAccounts");
    expect(load).toContain("archivedAccounts: archivedRows");
    expect(load).toContain("rows.filter((row) => row.isActive)");
    expect(load).toContain("for (const row of activeRows)");
  });
});
