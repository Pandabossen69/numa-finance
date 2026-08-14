import { describe, expect, it } from "vitest";
import {
  collectPairedVoidIds,
  isPairedMoneyMove,
  type TransferPairHints,
} from "./transfer-pair";

function tx(
  partial: Partial<TransferPairHints> & Pick<TransferPairHints, "id">,
): TransferPairHints {
  return {
    transactionType: "transfer",
    accountId: "a1",
    counterAccountId: "a2",
    amountMinor: 100_00,
    occurredAt: "2026-08-14T12:00:00.000Z",
    transferGroupId: null,
    status: "confirmed",
    ...partial,
  };
}

describe("transfer-pair", () => {
  it("recognizes paired money move types", () => {
    expect(isPairedMoneyMove("transfer")).toBe(true);
    expect(isPairedMoneyMove("cash_withdrawal")).toBe(true);
    expect(isPairedMoneyMove("expense")).toBe(false);
  });

  it("voids both legs that share transfer_group_id", () => {
    const out = tx({
      id: "out",
      transferGroupId: "g1",
      accountId: "bank",
      counterAccountId: "cash",
    });
    const inn = tx({
      id: "in",
      transferGroupId: "g1",
      accountId: "cash",
      counterAccountId: "bank",
    });
    const other = tx({
      id: "other",
      transferGroupId: "g2",
      accountId: "bank",
      counterAccountId: "cash",
    });

    expect(collectPairedVoidIds(out, [out, inn, other]).sort()).toEqual([
      "in",
      "out",
    ]);
  });

  it("matches legacy opposite leg without transfer_group_id", () => {
    const out = tx({
      id: "out",
      accountId: "bank",
      counterAccountId: "cash",
    });
    const inn = tx({
      id: "in",
      accountId: "cash",
      counterAccountId: "bank",
    });
    const mismatch = tx({
      id: "mismatch",
      accountId: "cash",
      counterAccountId: "bank",
      amountMinor: 50_00,
    });

    expect(collectPairedVoidIds(out, [out, inn, mismatch]).sort()).toEqual([
      "in",
      "out",
    ]);
  });

  it("only voids the target for ordinary expenses", () => {
    const expense = tx({
      id: "e1",
      transactionType: "expense",
      counterAccountId: null,
    });
    expect(collectPairedVoidIds(expense, [expense])).toEqual(["e1"]);
  });
});
