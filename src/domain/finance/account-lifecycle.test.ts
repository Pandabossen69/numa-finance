import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NOT_OWNED_SV,
  ALREADY_ARCHIVED_SV,
  ARCHIVE_REQUIRES_HISTORY_SV,
  ARCHIVE_REQUIRES_ZERO_SV,
  ARCHIVE_UNKNOWN_SALDO_SV,
  ARCHIVED_NO_NEW_TX_SV,
  CHOOSE_OTHER_DEFAULT_SV,
  CURRENCY_LOCKED_SV,
  DEFAULT_ACCOUNT_BLOCK_SV,
  DEFAULT_ACCOUNT_COPY_SV,
  DEFAULT_ACCOUNT_HELP_SV,
  DELETE_REQUIRES_ZERO_SV,
  DELETE_UNKNOWN_SALDO_SV,
  HAS_HISTORY_DELETE_SV,
  LAST_ACTIVE_ACCOUNT_SV,
  NOT_ARCHIVED_SV,
  accountHasLedgerHistory,
  accountTypeForKind,
  assertAccountAcceptsWrites,
  assertAccountOwned,
  evaluateArchiveAccount,
  evaluateCurrencyChange,
  evaluateDeleteAccount,
  evaluateKindChange,
  evaluateRestoreAccount,
  type AccountLifecycleFacts,
} from "./account-lifecycle";

const owner = "user-a";
const other = "user-b";

function facts(
  partial: Partial<AccountLifecycleFacts> = {},
): AccountLifecycleFacts {
  return {
    ownerUserId: owner,
    actorUserId: owner,
    isActive: true,
    isDefault: false,
    activeCount: 2,
    hasLedgerHistory: false,
    balanceMinor: 0,
    ...partial,
  };
}

describe("account ownership", () => {
  it("rejects another user's account", () => {
    expect(assertAccountOwned(owner, other)).toEqual({
      ok: false,
      error: ACCOUNT_NOT_OWNED_SV,
    });
    expect(evaluateDeleteAccount(facts({ actorUserId: other })).ok).toBe(false);
    expect(evaluateArchiveAccount(facts({ actorUserId: other })).ok).toBe(false);
    expect(evaluateRestoreAccount(facts({ actorUserId: other, isActive: false })).ok).toBe(
      false,
    );
  });

  it("accepts the owner", () => {
    expect(assertAccountOwned(owner, owner)).toEqual({ ok: true });
  });
});

describe("empty delete", () => {
  it("allows deleting an empty non-default account when another stays active", () => {
    expect(evaluateDeleteAccount(facts())).toEqual({ ok: true });
  });

  it("blocks hard-delete when the account has ledger history", () => {
    expect(evaluateDeleteAccount(facts({ hasLedgerHistory: true }))).toEqual({
      ok: false,
      error: HAS_HISTORY_DELETE_SV,
    });
  });

  it("does not treat voided rows as history", () => {
    expect(
      accountHasLedgerHistory([{ status: "voided" }, { status: "voided" }]),
    ).toBe(false);
    expect(
      accountHasLedgerHistory([{ status: "voided" }, { status: "confirmed" }]),
    ).toBe(true);
  });

  it("blocks deleting an empty account when saldo is not zero", () => {
    expect(
      evaluateDeleteAccount(
        facts({ hasLedgerHistory: false, balanceMinor: 111_00 }),
      ),
    ).toEqual({ ok: false, error: DELETE_REQUIRES_ZERO_SV });
  });

  it("blocks deleting an empty account when saldo is unknown", () => {
    expect(
      evaluateDeleteAccount(
        facts({ hasLedgerHistory: false, balanceMinor: null }),
      ),
    ).toEqual({ ok: false, error: DELETE_UNKNOWN_SALDO_SV });
  });
});

describe("archive with history", () => {
  it("archives a zero-balance account that has history", () => {
    expect(
      evaluateArchiveAccount(
        facts({ hasLedgerHistory: true, balanceMinor: 0 }),
      ),
    ).toEqual({ ok: true });
  });

  it("blocks archive when saldo is not zero", () => {
    expect(
      evaluateArchiveAccount(
        facts({ hasLedgerHistory: true, balanceMinor: 250_00 }),
      ),
    ).toEqual({ ok: false, error: ARCHIVE_REQUIRES_ZERO_SV });
  });

  it("blocks archive when saldo is unknown", () => {
    expect(
      evaluateArchiveAccount(
        facts({ hasLedgerHistory: true, balanceMinor: null }),
      ),
    ).toEqual({ ok: false, error: ARCHIVE_UNKNOWN_SALDO_SV });
  });

  it("does not archive an empty account — delete instead", () => {
    expect(evaluateArchiveAccount(facts({ hasLedgerHistory: false }))).toEqual({
      ok: false,
      error: ARCHIVE_REQUIRES_HISTORY_SV,
    });
  });
});

describe("default and last-active blocks", () => {
  it("blocks deleting or archiving the default account", () => {
    expect(evaluateDeleteAccount(facts({ isDefault: true }))).toEqual({
      ok: false,
      error: DEFAULT_ACCOUNT_BLOCK_SV,
    });
    expect(
      evaluateDeleteAccount(
        facts({
          isDefault: true,
          hasLedgerHistory: false,
          balanceMinor: 111_00,
        }),
      ),
    ).toEqual({ ok: false, error: DEFAULT_ACCOUNT_BLOCK_SV });
    expect(
      evaluateArchiveAccount(
        facts({ isDefault: true, hasLedgerHistory: true, balanceMinor: 0 }),
      ),
    ).toEqual({ ok: false, error: DEFAULT_ACCOUNT_BLOCK_SV });
    expect(CHOOSE_OTHER_DEFAULT_SV).toBe("Välj ett annat förvalt konto först.");
  });

  it("blocks retiring the last active account", () => {
    expect(evaluateDeleteAccount(facts({ activeCount: 1 }))).toEqual({
      ok: false,
      error: LAST_ACTIVE_ACCOUNT_SV,
    });
    expect(
      evaluateArchiveAccount(
        facts({ activeCount: 1, hasLedgerHistory: true, balanceMinor: 0 }),
      ),
    ).toEqual({ ok: false, error: LAST_ACTIVE_ACCOUNT_SV });
  });
});

describe("restore", () => {
  it("restores an archived account for its owner", () => {
    expect(evaluateRestoreAccount(facts({ isActive: false }))).toEqual({
      ok: true,
    });
  });

  it("rejects restore of an already active account", () => {
    expect(evaluateRestoreAccount(facts({ isActive: true }))).toEqual({
      ok: false,
      error: NOT_ARCHIVED_SV,
    });
  });
});

describe("currency lock", () => {
  it("allows currency change only without ledger history", () => {
    expect(evaluateCurrencyChange(facts(), "other", "EUR")).toEqual({ ok: true });
    expect(
      evaluateCurrencyChange(facts({ hasLedgerHistory: true }), "other", "EUR"),
    ).toEqual({ ok: false, error: CURRENCY_LOCKED_SV });
  });

  it("still enforces kind/currency pairing on empty accounts", () => {
    const result = evaluateCurrencyChange(facts(), "thai_bank", "EUR");
    expect(result.ok).toBe(false);
  });
});

describe("kind change", () => {
  it("allows a same-currency kind change even with history", () => {
    expect(
      evaluateKindChange(facts({ hasLedgerHistory: true }), "cash", "THB"),
    ).toEqual({ ok: true });
  });

  it("blocks a kind that needs a new currency when history exists", () => {
    const result = evaluateKindChange(
      facts({ hasLedgerHistory: true }),
      "swedish_bank",
      "THB",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected lock");
    expect(result.error).toContain(CURRENCY_LOCKED_SV);
  });
});

describe("archived write guard", () => {
  it("rejects new transactions on archived accounts", () => {
    expect(assertAccountAcceptsWrites({ isActive: false })).toEqual({
      ok: false,
      error: ARCHIVED_NO_NEW_TX_SV,
    });
    expect(assertAccountAcceptsWrites({ isActive: true })).toEqual({ ok: true });
    expect(assertAccountAcceptsWrites(null)).toEqual({
      ok: false,
      error: "Kontot hittades inte",
    });
  });

  it("maps cash kind to the cash account type", () => {
    expect(accountTypeForKind("cash", "checking")).toBe("cash");
    expect(accountTypeForKind("thai_bank", "cash")).toBe("checking");
    expect(accountTypeForKind("swedish_bank", "savings")).toBe("savings");
  });
});

describe("copy", () => {
  it("uses the default-account wording, not Hem-primary", () => {
    expect(DEFAULT_ACCOUNT_COPY_SV).toBe("Förvalt konto för nya utgifter");
    expect(DEFAULT_ACCOUNT_HELP_SV).toContain(
      "Alla konton räknas fortfarande ihop på Hem",
    );
    expect(DEFAULT_ACCOUNT_HELP_SV).toContain(
      "vilket konto som föreslås när en utgift skapas",
    );
    expect(DEFAULT_ACCOUNT_COPY_SV).not.toContain("Primärt konto för utgifter");
  });
});
