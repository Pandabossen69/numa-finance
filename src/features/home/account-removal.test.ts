import { beforeEach, describe, expect, it } from "vitest";
import type { AccountBalanceRow } from "@/features/finance/load-accounts";
import {
  adoptRemovedAccount,
  clearClientSessionCaches,
  lastAccountsSnapshot,
  rememberAccountsSnapshot,
} from "@/features/home/last-snapshot";

function row(
  id: string,
  name: string,
  thb: number,
  isDefault = false,
): AccountBalanceRow {
  return {
    id,
    name,
    institution: null,
    maskedIdentifier: null,
    kind: "thai_bank",
    kindLabelSv: "Thai-bank",
    currency: "THB",
    isDefault,
    isActive: true,
    calculatedMinor: thb,
    thbMinor: thb,
    fxRate: 1,
    fxSource: "identity",
  };
}

describe("adoptRemovedAccount", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("drops an archived account from På kontona and keeps it under Arkiverade", () => {
    const bank = row("bank", "Bangkok Bank", 8_000_00, true);
    const cash = row("cash", "Kontant", 2_000_00);
    rememberAccountsSnapshot({
      accounts: [bank, cash],
      archivedAccounts: [],
      totalThbMinor: 10_000_00,
    });

    adoptRemovedAccount(
      {
        removedAccount: { mode: "archive" },
        accounts: {
          accounts: [{ ...cash, isDefault: true }],
          archivedAccounts: [],
          totalThbMinor: 2_000_00,
        },
      },
      bank.id,
    );

    const next = lastAccountsSnapshot();
    expect(next?.accounts.map((account) => account.id)).toEqual(["cash"]);
    expect(next?.archivedAccounts?.map((account) => account.name)).toEqual([
      "Bangkok Bank",
    ]);
    expect(next?.totalThbMinor).toBe(2_000_00);
  });

  it("hard-deletes an empty account out of both lists", () => {
    const only = row("only", "Sparkonto", 500_00, true);
    rememberAccountsSnapshot({
      accounts: [only],
      archivedAccounts: [],
      totalThbMinor: 500_00,
    });

    adoptRemovedAccount({ removedAccount: { mode: "delete" } }, only.id);

    const next = lastAccountsSnapshot();
    expect(next?.accounts).toEqual([]);
    expect(next?.archivedAccounts).toEqual([]);
    expect(next?.totalThbMinor).toBeNull();
  });
});
