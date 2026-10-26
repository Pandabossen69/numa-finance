import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AccountsDashboard.tsx", import.meta.url), "utf8");
const load = readFileSync(
  new URL("../../features/finance/load-accounts.ts", import.meta.url),
  "utf8",
);

describe("AccountsDashboard", () => {
  it("shows last-known saldo instead of blocking on a cold fetch", () => {
    expect(src).toContain("paintableAccountsSnapshot");
    expect(src).toContain("rememberAccountsSnapshot");
    expect(src).toContain("subscribeAccountsSnapshot");
    expect(src).toContain("serverNull");
    expect(src).not.toContain("stored ?? paintableAccountsSnapshot()");
    expect(src).toContain("AccountsViewLoading");
    expect(src).toContain("onMouseEnter");
    expect(src).toContain("onFocus");
  });

  it("labels the account total as converted to THB", () => {
    expect(src).toContain("Totalt i THB");
    expect(src).toContain("SV.saldoAllaKontonHint");
    expect(src).not.toContain("Det du äger — Hem och Plan använder detta");
    expect(src).not.toMatch(/>\s*Totalt\s*</);
  });

  it("paints the total, the THB equivalent and the account balance in neutral ink", () => {
    const displays = [...src.matchAll(/<MoneyDisplay[\s\S]*?\/>/g)].map((match) => match[0]);
    expect(displays).toHaveLength(3);
    expect(displays[0]).toContain("amountMinor={view.totalThbMinor}");
    expect(displays[1]).toContain("amountMinor={account.thbMinor}");
    expect(displays[1]).toContain("compact");
    expect(displays[2]).toContain("amountMinor={account.calculatedMinor}");
    for (const block of displays) {
      expect(block).toContain('tone="neutral"');
    }
  });

  it("keeps a row into the detail screen and folds archived accounts", () => {
    expect(src).toContain("Inga konton ännu. Snabbast är att fota bank-SMS via +.");
    expect(src).toContain("/fota?mode=sms");
    expect(src).toContain("Ange manuellt");
    expect(src).toContain("Förvalt");
    expect(src).not.toContain("numa-chip-mint");
    expect(src).not.toContain("numa-btn numa-btn-soft is-accent");
    expect(src).not.toContain("Uppdatera saldo");
    expect(src).toContain("accountEditError");
    expect(src).toContain("Arkiverade (");
    expect(src).toContain("<details");
    expect(src).toContain("Återställ eller hantera");
    expect(src).not.toContain("openVerifyId");
    expect(src).toContain("ChevronRight");
  });

  it("loads every account from one ledger plus checkpoints", () => {
    expect(load).toContain("listTransactions()");
    expect(load).toContain("getLatestCheckpoint");
    expect(load).toContain("calculateAccountBalance");
    expect(load).toContain("filterTransactionsAfterCheckpoint");
    expect(load).not.toContain("getTodaySnapshot");
    expect(load).toContain("sortAccountsForList");
  });
});
