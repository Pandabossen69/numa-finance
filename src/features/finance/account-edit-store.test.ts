import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountBalanceRow } from "@/features/finance/load-accounts";
import {
  clearClientSessionCaches,
  lastAccountsSnapshot,
  rememberAccountsSnapshot,
} from "@/features/home/last-snapshot";

vi.mock("@/features/finance/actions", () => ({
  updateAccountAction: vi.fn(),
}));

import { updateAccountAction } from "@/features/finance/actions";
import {
  accountEditError,
  adoptServerAccountsSnapshot,
  beginAccountBalanceEdit,
  publishAccountDetailsEdit,
  resetAccountEditStateForTests,
  rollbackAccountEdit,
} from "@/features/finance/account-edit-store";

const updateAccount = vi.mocked(updateAccountAction);

function row(id: string, name: string, calculatedMinor: number): AccountBalanceRow {
  return {
    id,
    name,
    institution: null,
    maskedIdentifier: null,
    kind: "thai_bank",
    kindLabelSv: "Thai-bank",
    currency: "THB",
    isDefault: id === "a",
    isActive: true,
    calculatedMinor,
    thbMinor: calculatedMinor,
    fxRate: 1,
    fxSource: "identity",
  };
}

beforeEach(() => {
  clearClientSessionCaches();
  resetAccountEditStateForTests();
  updateAccount.mockReset();
  rememberAccountsSnapshot({
    accounts: [row("a", "Ett", 1_000), row("b", "Två", 500)],
    archivedAccounts: [],
    totalThbMinor: 1_500,
  });
});

describe("account edit store", () => {
  it("paints a rename immediately and rolls it back with a Swedish error", async () => {
    let settle: (result: { ok: false; error: string }) => void = () => {};
    updateAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );

    const edit = publishAccountDetailsEdit({
      id: "a",
      name: "Nytt",
      kind: "thai_bank",
      currency: "THB",
      makeDefault: false,
    });
    expect(edit.painted).toBe(true);
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Nytt");
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(1_500);

    settle({ ok: false, error: "Kunde inte spara kontot" });
    await expect(edit.done).resolves.toEqual({
      ok: false,
      error: "Kunde inte spara kontot",
    });
    expect(accountEditError()).toBe("Kunde inte spara kontot");
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Ett");
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(1_500);
    expect(lastAccountsSnapshot()?.accounts[1]?.name).toBe("Två");
  });

  it("rolls a fetch failure back to the offline line and does not pretend it saved", async () => {
    updateAccount.mockRejectedValue(new TypeError("Failed to fetch"));
    const edit = publishAccountDetailsEdit({
      id: "a",
      name: "Nytt",
      kind: "thai_bank",
      currency: "THB",
      makeDefault: false,
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Nytt");
    await expect(edit.done).resolves.toEqual({
      ok: false,
      error: "Ingen anslutning. Inget sparades.",
    });
    expect(lastAccountsSnapshot()?.accounts[0]?.name).toBe("Ett");
    expect(accountEditError()).toBe("Ingen anslutning. Inget sparades.");
  });

  it("does not let a late saldo response overwrite a newer amount", () => {
    const first = beginAccountBalanceEdit("a", 2_000);
    const second = beginAccountBalanceEdit("a", 4_000);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(4_000);
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(4_500);

    expect(rollbackAccountEdit("a", first!)).toBe(false);
    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(4_000);
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(4_500);

    const staleServer = {
      accounts: [row("a", "Ett", 1_000), row("b", "Två", 500)],
      archivedAccounts: [],
      totalThbMinor: 1_500,
    };
    expect(adoptServerAccountsSnapshot(staleServer)).toBe(true);
    expect(lastAccountsSnapshot()?.accounts[0]?.calculatedMinor).toBe(4_000);
    expect(lastAccountsSnapshot()?.totalThbMinor).toBe(4_500);
  });
});
