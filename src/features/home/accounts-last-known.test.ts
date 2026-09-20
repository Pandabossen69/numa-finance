import { describe, expect, it } from "vitest";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import {
  accountsLastKnownCanPaint,
  accountsSnapshotIsPoorer,
  decideAccountsLastKnown,
} from "./accounts-last-known";

function account(
  id: string,
  thbMinor: number,
  name = id,
): AccountsSnapshot["accounts"][number] {
  return {
    id,
    name,
    institution: null,
    maskedIdentifier: null,
    kind: id === "tm" ? "other" : "thai_bank",
    kindLabelSv: id === "tm" ? "Annat" : "Thai-bank",
    currency: "THB",
    isDefault: id === "bb",
    isActive: true,
    calculatedMinor: thbMinor,
    thbMinor,
    fxRate: 1,
    fxSource: "identity",
  };
}

function snap(
  rows: Array<[id: string, thb: number, name?: string]>,
  total = rows.reduce((sum, [, thb]) => sum + thb, 0),
): AccountsSnapshot {
  return {
    accounts: rows.map(([id, thb, name]) => account(id, thb, name)),
    archivedAccounts: [],
    totalThbMinor: total,
  };
}

/** Hugo Qualityltf: older CP ~11 sep vs latest CP that Hem «På kontona» shows. */
const STALE_SEP11 = snap(
  [
    ["bb", 7_760_00, "Bangkok Bank"],
    ["cash", 190_00, "Kontanter"],
  ],
  7_950_00,
);
const FRESH_WITH_TRUEMONEY = snap(
  [
    ["bb", 3_231_95, "Bangkok Bank"],
    ["cash", 0, "Kontanter"],
    ["tm", 190_00, "TrueMoney"],
  ],
  3_421_95,
);
const HEM_PA_KONTONA = 3_421_95;

describe("accountsLastKnownCanPaint — Spec S stale lastAccountsSnapshot", () => {
  it("refuses a stale total that disagrees with Hem På kontona", () => {
    expect(
      accountsLastKnownCanPaint(STALE_SEP11, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe(false);
  });

  it("refuses last-known that hides TrueMoney a fresher source already has", () => {
    expect(
      accountsLastKnownCanPaint(STALE_SEP11, {
        hemBalanceMinor: HEM_PA_KONTONA,
        fresherAccounts: FRESH_WITH_TRUEMONEY,
      }),
    ).toBe(false);
    expect(
      accountsLastKnownCanPaint(
        snap([
          ["bb", 3_231_95],
          ["cash", 190_00],
        ], HEM_PA_KONTONA),
        { hemBalanceMinor: HEM_PA_KONTONA, fresherAccounts: FRESH_WITH_TRUEMONEY },
      ),
    ).toBe(false);
  });

  it("allows last-known that matches Hem and is not missing fresher ids", () => {
    expect(
      accountsLastKnownCanPaint(FRESH_WITH_TRUEMONEY, {
        hemBalanceMinor: HEM_PA_KONTONA,
        fresherAccounts: FRESH_WITH_TRUEMONEY,
      }),
    ).toBe(true);
  });

  it("allows last-known richer than Plan when the total still matches Hem", () => {
    const planWithoutTrueMoney = snap(
      [
        ["bb", 3_231_95],
        ["cash", 190_00],
      ],
      HEM_PA_KONTONA,
    );
    expect(
      accountsLastKnownCanPaint(FRESH_WITH_TRUEMONEY, {
        hemBalanceMinor: HEM_PA_KONTONA,
        fresherAccounts: planWithoutTrueMoney,
      }),
    ).toBe(true);
    expect(
      accountsSnapshotIsPoorer(planWithoutTrueMoney, FRESH_WITH_TRUEMONEY),
    ).toBe(true);
  });

  it("does not treat a matching last-known as unpaintable when Hem has no saldo yet", () => {
    expect(accountsLastKnownCanPaint(STALE_SEP11, {})).toBe(true);
    expect(accountsLastKnownCanPaint(null, { hemBalanceMinor: HEM_PA_KONTONA })).toBe(
      false,
    );
  });
});

describe("decideAccountsLastKnown — never let stale last-known win", () => {
  it("invalidates stale total when Hem updates and there is no safe incoming", () => {
    expect(
      decideAccountsLastKnown(STALE_SEP11, null, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("invalidate");
  });

  it("replaces incomplete last-known with a Hem-aligned fresher list that has TrueMoney", () => {
    expect(
      decideAccountsLastKnown(STALE_SEP11, FRESH_WITH_TRUEMONEY, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("replace");
  });

  it("does not gap-fill a Plan snapshot whose total disagrees with Hem", () => {
    expect(
      decideAccountsLastKnown(null, STALE_SEP11, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("keep");
  });

  it("gap-fills when last-known is empty and incoming matches Hem", () => {
    expect(
      decideAccountsLastKnown(null, FRESH_WITH_TRUEMONEY, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("replace");
  });

  it("keeps a richer last-known and does not clobber it with a poorer Plan list", () => {
    const poorerPlan = snap(
      [
        ["bb", 3_231_95],
        ["cash", 190_00],
      ],
      HEM_PA_KONTONA,
    );
    expect(
      decideAccountsLastKnown(FRESH_WITH_TRUEMONEY, poorerPlan, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("keep");
  });

  it("invalidates instead of painting a poorer Plan list over a stale richer one", () => {
    const poorerFreshTotal = snap([["bb", HEM_PA_KONTONA]], HEM_PA_KONTONA);
    expect(
      decideAccountsLastKnown(STALE_SEP11, poorerFreshTotal, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("invalidate");
  });

  it("keeps last-known when it already matches Hem and incoming only changes names", () => {
    const renamed = {
      ...FRESH_WITH_TRUEMONEY,
      accounts: FRESH_WITH_TRUEMONEY.accounts.map((row) =>
        row.id === "bb" ? { ...row, name: "Should not clobber" } : row,
      ),
    };
    expect(
      decideAccountsLastKnown(FRESH_WITH_TRUEMONEY, renamed, {
        hemBalanceMinor: HEM_PA_KONTONA,
      }),
    ).toBe("keep");
  });
});
