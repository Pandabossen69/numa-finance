import { describe, expect, it } from "vitest";
import {
  isCashAccount,
  manualAccountsFromSources,
  resolveListedAccountId,
} from "./manual-accounts";

const stub = [
  {
    id: "bb",
    name: "Konto",
    accountType: "checking",
    currency: "THB",
  },
];

const five = [
  {
    id: "bb",
    name: "Bangkok Bank",
    kind: "thai_bank",
    accountType: "checking",
    currency: "THB",
    isActive: true,
    fxRate: 1,
  },
  {
    id: "kbank",
    name: "Kasikorn",
    kind: "thai_bank",
    accountType: "checking",
    currency: "THB",
    isActive: true,
    fxRate: 1,
  },
  {
    id: "cash",
    name: "Testkontant",
    kind: "cash",
    accountType: "checking",
    currency: "THB",
    isActive: true,
    fxRate: 1,
  },
  {
    id: "seb",
    name: "SEB",
    kind: "swedish_bank",
    accountType: "checking",
    currency: "SEK",
    isActive: true,
    fxRate: 3.2,
  },
  {
    id: "usd",
    name: "USD-konto",
    kind: "other",
    accountType: "checking",
    currency: "USD",
    isActive: true,
    fxRate: 33,
  },
  {
    id: "old",
    name: "Arkiverat",
    kind: "thai_bank",
    accountType: "checking",
    currency: "THB",
    isActive: false,
  },
];

describe("manualAccountsFromSources", () => {
  it("keeps the boot stub until the Konton snapshot arrives", () => {
    expect(manualAccountsFromSources({ shell: stub, known: null })).toEqual([
      {
        id: "bb",
        name: "Konto",
        accountType: "checking",
        currency: "THB",
        fxRate: null,
        kind: undefined,
      },
    ]);
  });

  it("replaces the stub with every active account, including kind cash", () => {
    const accounts = manualAccountsFromSources({ shell: stub, known: five });
    expect(accounts.map((account) => account.name)).toEqual([
      "Bangkok Bank",
      "Kasikorn",
      "Testkontant",
      "SEB",
      "USD-konto",
    ]);
    expect(accounts.find((account) => account.id === "cash")).toMatchObject({
      accountType: "cash",
      kind: "cash",
    });
    expect(isCashAccount(accounts.find((account) => account.id === "cash")!)).toBe(
      true,
    );
    expect(accounts.some((account) => account.name === "Konto")).toBe(false);
    expect(accounts.some((account) => account.name === "Arkiverat")).toBe(false);
  });

  it("keeps a chosen id once the late list includes it", () => {
    expect(resolveListedAccountId("missing", five, "bb")).toBe("bb");
    expect(resolveListedAccountId("", five)).toBe("bb");
    expect(resolveListedAccountId("seb", five, "bb")).toBe("seb");
  });
});
