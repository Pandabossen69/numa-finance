import { describe, expect, it } from "vitest";
import {
  balanceToThbMinor,
  totalSaldoThbMinor,
} from "./total-saldo";
import type { Account, BalanceCheckpoint } from "./types";

function account(
  partial: Partial<Account> & Pick<Account, "id" | "currency" | "kind">,
): Account {
  return {
    userId: "u1",
    name: partial.name ?? partial.id,
    institution: null,
    accountType: "checking",
    maskedIdentifier: null,
    isActive: true,
    isDefault: false,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...partial,
  };
}

function checkpoint(
  partial: Partial<BalanceCheckpoint> &
    Pick<BalanceCheckpoint, "accountId" | "balanceMinor" | "currency">,
): BalanceCheckpoint {
  return {
    id: "cp",
    userId: "u1",
    thbMinor: null,
    fxRate: null,
    fxAsOf: null,
    fxSource: null,
    verifiedAt: "2026-08-31T00:00:00.000Z",
    source: "manual",
    sourceObservationId: null,
    note: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    ...partial,
  };
}

describe("totalSaldoThbMinor", () => {
  it("sums THB accounts 1:1", () => {
    const thai = account({ id: "t", currency: "THB", kind: "thai_bank" });
    const cash = account({ id: "c", currency: "THB", kind: "cash" });
    const total = totalSaldoThbMinor([
      {
        account: thai,
        nativeMinor: 10_000_00,
        checkpoint: checkpoint({
          accountId: "t",
          balanceMinor: 10_000_00,
          currency: "THB",
          thbMinor: 10_000_00,
          fxRate: 1,
        }),
      },
      {
        account: cash,
        nativeMinor: 2_000_00,
        checkpoint: checkpoint({
          accountId: "c",
          balanceMinor: 2_000_00,
          currency: "THB",
          thbMinor: 2_000_00,
          fxRate: 1,
        }),
      },
    ]);
    expect(total).toBe(12_000_00);
  });

  it("locks EUR with fxRate at write (does not need live rate)", () => {
    const revolut = account({ id: "r", currency: "EUR", kind: "revolut" });
    const cp = checkpoint({
      accountId: "r",
      balanceMinor: 100_00,
      currency: "EUR",
      thbMinor: 3_800_00,
      fxRate: 38,
      fxSource: "manual",
    });
    expect(balanceToThbMinor(100_00, "EUR", cp)).toBe(3_800_00);
    // After a spend, same locked rate applies to the new native balance.
    expect(balanceToThbMinor(90_00, "EUR", cp)).toBe(3_420_00);
  });

  it("returns null when nothing is known — never fake ฿0", () => {
    const thai = account({ id: "t", currency: "THB", kind: "thai_bank" });
    expect(
      totalSaldoThbMinor([{ account: thai, nativeMinor: null, checkpoint: null }]),
    ).toBeNull();
  });

  it("skips non-THB without a locked rate instead of inventing one", () => {
    const bunq = account({ id: "b", currency: "EUR", kind: "bunq" });
    const total = totalSaldoThbMinor([
      {
        account: bunq,
        nativeMinor: 50_00,
        checkpoint: checkpoint({
          accountId: "b",
          balanceMinor: 50_00,
          currency: "EUR",
        }),
      },
    ]);
    // any=true but contribution 0 — still "known" empty convertible set
    expect(total).toBe(0);
  });
});
