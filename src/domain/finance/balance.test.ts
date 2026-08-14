import { describe, expect, it } from "vitest";
import {
  appliesToIncome,
  appliesToSpending,
  calculateAccountBalance,
  computeSpendingWindows,
  filterTransactionsAfterCheckpoint,
  resolveSmsTipBalanceMinor,
  shouldWriteSmsTipCheckpoint,
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

  it("bank-SMS rows never move saldo even after manual verification", () => {
    const verified = checkpoint({
      balanceMinor: 1_000_000,
      verifiedAt: "2026-08-11T14:00:00.000Z",
      source: "manual_verification",
    });
    const credit = tx({
      direction: "credit",
      transactionType: "income",
      amountMinor: 50_000,
      source: "screenshot",
      occurredAt: "2026-08-11T15:00:00.000Z",
    });

    const after = filterTransactionsAfterCheckpoint([credit], verified);
    expect(after).toHaveLength(0);

    // Defense in depth: even if filter is skipped, calc ignores bank-SMS.
    const balance = calculateAccountBalance({
      checkpoint: verified,
      transactionsAfterCheckpoint: [credit],
    });
    expect(balance?.amountMinor).toBe(1_000_000);
  });

  it("legacy checkpoint source sms also excludes screenshot rows", () => {
    const tip = checkpoint({
      balanceMinor: 1_010_804,
      verifiedAt: "2026-08-11T14:00:00.000Z",
      source: "sms",
    });
    const credit = tx({
      direction: "credit",
      transactionType: "income",
      amountMinor: 340_000,
      source: "screenshot",
      occurredAt: "2026-08-11T14:00:01.000Z",
    });
    expect(filterTransactionsAfterCheckpoint([credit], tip)).toHaveLength(0);
  });

  it("rewound tip would erase later manuals — filter keeps manuals after tip time", () => {
    // Tip at T0; lunch at T1; if a bad re-import rewound tip verifiedAt to T2,
    // lunch drops out. Correct confirm must not write that tip — but if tip
    // stays at T0, lunch still applies.
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
    expect(
      calculateAccountBalance({
        checkpoint: tip,
        transactionsAfterCheckpoint: after,
      })?.amountMinor,
    ).toBe(998_804);
  });
});

describe("bank-SMS rows: spend yes, income/saldo no", () => {
  it("counts screenshot expenses toward spending but not income", () => {
    expect(
      appliesToSpending({
        transactionType: "expense",
        status: "confirmed",
        source: "screenshot",
      }),
    ).toBe(true);
    expect(
      appliesToIncome({
        transactionType: "income",
        status: "confirmed",
        source: "screenshot",
      }),
    ).toBe(false);
    expect(
      appliesToSpending({
        transactionType: "expense",
        status: "confirmed",
        source: "manual",
      }),
    ).toBe(true);
    expect(
      appliesToIncome({
        transactionType: "income",
        status: "confirmed",
        source: "manual",
      }),
    ).toBe(true);
  });

  it("counts source sms expenses the same way as screenshot", () => {
    expect(
      appliesToSpending({
        transactionType: "expense",
        status: "confirmed",
        source: "sms",
      }),
    ).toBe(true);
    expect(
      appliesToIncome({
        transactionType: "income",
        status: "confirmed",
        source: "sms",
      }),
    ).toBe(false);
  });

  it("screenshot/sms expenses count in spending windows (tip still owns saldo)", () => {
    const now = new Date("2026-08-11T10:00:00.000Z");
    const windows = computeSpendingWindows({
      transactions: [
        tx({
          id: "sms-debit",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 10_560_700,
          source: "screenshot",
          occurredAt: "2026-08-11T09:00:00.000Z",
        }),
        tx({
          id: "sms-legacy",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 50_000,
          source: "sms",
          occurredAt: "2026-08-11T09:30:00.000Z",
        }),
      ],
      currency: "THB",
      now,
      timeZone: "Asia/Bangkok",
    });
    expect(windows.today.amountMinor).toBe(10_610_700);
    expect(windows.month.amountMinor).toBe(10_610_700);
  });
});

describe("computeSpendingWindows (Asia/Bangkok)", () => {
  const tz = "Asia/Bangkok";
  // 17:00 UTC = midnight+0 Bangkok Aug 12… use mid-morning Bangkok Aug 11.
  const now = new Date("2026-08-11T06:00:00.000Z"); // 13:00 Bangkok Aug 11

  it("does not count a previous Bangkok calendar day in todaySpending", () => {
    const yesterdayBangkok = tx({
      id: "yesterday",
      direction: "debit",
      transactionType: "expense",
      amountMinor: 200_000,
      source: "manual",
      // 16:00 UTC Aug 10 = 23:00 Bangkok Aug 10 (previous local day)
      occurredAt: "2026-08-10T16:00:00.000Z",
    });
    const todayBangkok = tx({
      id: "today",
      direction: "debit",
      transactionType: "expense",
      amountMinor: 15_000,
      source: "manual",
      // 17:30 UTC Aug 10 = 00:30 Bangkok Aug 11 (same local day as now)
      occurredAt: "2026-08-10T17:30:00.000Z",
    });

    const windows = computeSpendingWindows({
      transactions: [yesterdayBangkok, todayBangkok],
      currency: "THB",
      now,
      timeZone: tz,
    });

    expect(windows.today.amountMinor).toBe(15_000);
    expect(windows.month.amountMinor).toBe(215_000);
  });

  it("keeps todaySpending <= monthSpending for the same currency filter", () => {
    const windows = computeSpendingWindows({
      transactions: [
        tx({
          id: "a",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 10_000,
          source: "manual",
          occurredAt: "2026-08-01T04:00:00.000Z",
        }),
        tx({
          id: "b",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 25_000,
          source: "receipt_camera",
          occurredAt: "2026-08-11T05:00:00.000Z",
        }),
        tx({
          id: "c",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 99_000,
          source: "screenshot",
          occurredAt: "2026-08-11T05:30:00.000Z",
        }),
      ],
      currency: "THB",
      now,
      timeZone: tz,
    });

    expect(windows.today.amountMinor).toBe(124_000);
    expect(windows.month.amountMinor).toBe(134_000);
    expect(windows.today.amountMinor).toBeLessThanOrEqual(
      windows.month.amountMinor,
    );
  });

  it("counts fingerprint+tip bank-SMS expenses toward spending windows", () => {
    const windows = computeSpendingWindows({
      transactions: [
        tx({
          id: "legacy-sms",
          direction: "debit",
          transactionType: "expense",
          amountMinor: 500_000,
          source: "receipt_camera",
          occurredAt: "2026-08-11T05:00:00.000Z",
          fingerprint: "fp-legacy",
          balanceAfterMinor: 1_000_000,
          sourceObservationId: "obs-1",
        }),
      ],
      currency: "THB",
      now,
      timeZone: tz,
    });
    expect(windows.today.amountMinor).toBe(500_000);
    expect(windows.month.amountMinor).toBe(500_000);
  });
});

describe("SMS tip checkpoint write guards", () => {
  it("writes tip only when tip bubble is in the import batch", () => {
    expect(
      shouldWriteSmsTipCheckpoint({
        tipBalanceMinor: 1_010_804,
        tipInBatch: true,
      }),
    ).toBe(true);
    expect(
      shouldWriteSmsTipCheckpoint({
        tipBalanceMinor: 1_010_804,
        tipInBatch: false,
      }),
    ).toBe(false);
    expect(
      shouldWriteSmsTipCheckpoint({
        tipBalanceMinor: null,
        tipInBatch: true,
      }),
    ).toBe(false);
  });

  it("never falls back to oldest bubble balance as tip", () => {
    expect(
      resolveSmsTipBalanceMinor({
        inputBalanceAfterMinor: null,
        payloadTipBalanceMinor: 1_010_804,
        updatesBalance: true,
      }),
    ).toBe(1_010_804);

    // updatesBalance false → ignore both input and payload tip
    expect(
      resolveSmsTipBalanceMinor({
        inputBalanceAfterMinor: 1_010_804,
        payloadTipBalanceMinor: 1_010_804,
        updatesBalance: false,
      }),
    ).toBeNull();

    // No payload tip and no input → null (do NOT invent from bubble row)
    expect(
      resolveSmsTipBalanceMinor({
        inputBalanceAfterMinor: null,
        payloadTipBalanceMinor: null,
        updatesBalance: true,
      }),
    ).toBeNull();
  });

  it("batch clock: tip credit before tip checkpoint never double-applies", () => {
    const baseMs = Date.parse("2026-08-11T14:00:00.000Z");
    const tip = checkpoint({
      balanceMinor: 1_010_804,
      verifiedAt: new Date(baseMs).toISOString(),
      source: "sms_bootstrap",
    });
    // Synthetic SMS timestamps: oldest → newest, all strictly before tip.
    const credit = tx({
      id: "credit",
      direction: "credit",
      transactionType: "income",
      amountMinor: 340_000,
      source: "screenshot",
      occurredAt: new Date(baseMs - 3_000).toISOString(),
      balanceAfterMinor: 1_010_804,
    });
    const debit = tx({
      id: "debit",
      direction: "debit",
      transactionType: "expense",
      amountMinor: 12_000,
      source: "screenshot",
      occurredAt: new Date(baseMs - 6_000).toISOString(),
    });

    const after = filterTransactionsAfterCheckpoint([credit, debit], tip);
    expect(after).toHaveLength(0);
    expect(
      calculateAccountBalance({
        checkpoint: tip,
        transactionsAfterCheckpoint: [credit, debit],
      })?.amountMinor,
    ).toBe(1_010_804);
  });
});
