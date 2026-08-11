import { describe, expect, it } from "vitest";
import {
  calculateAccountBalance,
  filterTransactionsAfterCheckpoint,
} from "./balance";
import type { BalanceCheckpoint, CanonicalTransaction } from "./types";

function checkpoint(
  overrides: Partial<BalanceCheckpoint> & {
    balanceMinor: number;
    verifiedAt: string;
    source: string;
  },
): BalanceCheckpoint {
  return {
    id: "cp-1",
    userId: "u1",
    accountId: "a1",
    currency: "THB",
    sourceObservationId: null,
    note: null,
    createdAt: overrides.verifiedAt,
    ...overrides,
  };
}

function tx(
  overrides: Partial<CanonicalTransaction> & {
    amountMinor: number;
    occurredAt: string;
    direction: "debit" | "credit";
    transactionType: "expense" | "income";
    source: CanonicalTransaction["source"];
  },
): CanonicalTransaction {
  return {
    id: overrides.id ?? "tx-1",
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: "test",
    merchant: null,
    category: null,
    status: "confirmed",
    balanceAfterMinor: overrides.balanceAfterMinor ?? null,
    fingerprint: null,
    sourceObservationId: null,
    syncStatus: "saved",
    createdAt: overrides.occurredAt,
    updatedAt: overrides.occurredAt,
    ...overrides,
  };
}

describe("SMS tip saldo must not double-count", () => {
  it("Hugo case: tip 10108.04 + PromptPay 3400 screenshot stays 10108.04", () => {
    const tip = checkpoint({
      balanceMinor: 1_010_804,
      verifiedAt: "2026-08-11T14:00:00.000Z",
      source: "sms_bootstrap",
    });
    const credit = tx({
      id: "credit-3400",
      direction: "credit",
      transactionType: "income",
      amountMinor: 340_000,
      source: "screenshot",
      // Bug mode: tip credit landed at/after checkpoint
      occurredAt: "2026-08-11T14:00:01.000Z",
      balanceAfterMinor: 1_010_804,
    });

    const after = filterTransactionsAfterCheckpoint([credit], tip);
    expect(after).toHaveLength(0);

    const balance = calculateAccountBalance({
      checkpoint: tip,
      transactionsAfterCheckpoint: after,
    });
    expect(balance?.amountMinor).toBe(1_010_804);
  });

  it("manual expense after SMS tip still reduces saldo", () => {
    const tip = checkpoint({
      balanceMinor: 1_010_804,
      verifiedAt: "2026-08-11T14:00:00.000Z",
      source: "sms_import",
    });
    const lunch = tx({
      id: "lunch",
      direction: "debit",
      transactionType: "expense",
      amountMinor: 12_000,
      source: "manual",
      occurredAt: "2026-08-11T15:00:00.000Z",
    });

    const after = filterTransactionsAfterCheckpoint([lunch], tip);
    expect(after).toHaveLength(1);

    const balance = calculateAccountBalance({
      checkpoint: tip,
      transactionsAfterCheckpoint: after,
    });
    expect(balance?.amountMinor).toBe(1_010_804 - 12_000);
  });

  it("non-SMS checkpoint still applies screenshot rows", () => {
    const verified = checkpoint({
      balanceMinor: 1_000_000,
      verifiedAt: "2026-08-11T14:00:00.000Z",
      source: "manual_verify",
    });
    const credit = tx({
      direction: "credit",
      transactionType: "income",
      amountMinor: 50_000,
      source: "screenshot",
      occurredAt: "2026-08-11T15:00:00.000Z",
    });

    const after = filterTransactionsAfterCheckpoint([credit], verified);
    expect(after).toHaveLength(1);
    const balance = calculateAccountBalance({
      checkpoint: verified,
      transactionsAfterCheckpoint: after,
    });
    expect(balance?.amountMinor).toBe(1_050_000);
  });
});
