import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AccountsDashboard.tsx", import.meta.url), "utf8");
const load = readFileSync(
  new URL("../../features/finance/load-accounts.ts", import.meta.url),
  "utf8",
);

describe("AccountsDashboard", () => {
  it("shows last-known saldo instead of blocking on a cold fetch", () => {
    expect(src).toContain("lastAccountsSnapshot");
    expect(src).toContain("rememberAccountsSnapshot");
    expect(src).toContain("subscribeAccountsSnapshot");
    expect(src).toContain("AccountsViewLoading");
    expect(src).toContain("onMouseEnter");
    expect(src).toContain("onFocus");
  });

  it("keeps the empty-state Swedish copy and Fota path", () => {
    expect(src).toContain("Inga konton ännu. Snabbast är att fota bank-SMS via +.");
    expect(src).toContain("/fota?mode=sms");
    expect(src).toContain("Ange manuellt");
    expect(src).toContain("Uppdatera saldo");
    expect(src).toContain("openVerifyId");
  });

  it("loads every account from one ledger plus checkpoints", () => {
    expect(load).toContain("listTransactions()");
    expect(load).toContain("getLatestCheckpoint");
    expect(load).toContain("calculateAccountBalance");
    expect(load).toContain("filterTransactionsAfterCheckpoint");
    expect(load).not.toContain("getTodaySnapshot");
  });
});
