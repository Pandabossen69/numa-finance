import { describe, expect, it } from "vitest";
import {
  applyTransactionToBalance,
  appliesToSpending,
  buildTransactionFingerprint,
  calculateAccountBalance,
  calculateSafeToSpend,
  matchFingerprint,
  recalculateAfterSpend,
} from "@/domain/finance";
import { money } from "@/domain/money";
import { majorStringToMinor, BangkokBankSmsParser } from "@/domain/imports/bank-parsers";

describe("balance engine", () => {
  it("reduces calculated balance for expenses", () => {
    const checkpoint = {
      id: "c1",
      userId: "u1",
      accountId: "a1",
      balanceMinor: 1005804,
      currency: "THB" as const,
      verifiedAt: "2026-08-09T10:00:00.000Z",
      source: "test",
      sourceObservationId: null,
      note: null,
      createdAt: "2026-08-09T10:00:00.000Z",
    };

    const expense = {
      id: "t1",
      userId: "u1",
      accountId: "a1",
      counterAccountId: null,
      direction: "debit" as const,
      transactionType: "expense" as const,
      amountMinor: 62000,
      currency: "THB" as const,
      occurredAt: "2026-08-09T11:00:00.000Z",
      description: "Test",
      merchant: null,
      category: "Mat",
      source: "manual" as const,
      status: "confirmed" as const,
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      transferGroupId: null,
      syncStatus: "saved" as const,
      createdAt: "2026-08-09T11:00:00.000Z",
      updatedAt: "2026-08-09T11:00:00.000Z",
    };

    const balance = calculateAccountBalance({
      checkpoint,
      transactionsAfterCheckpoint: [expense],
    });
    expect(balance?.amountMinor).toBe(1005804 - 62000);
    expect(appliesToSpending(expense)).toBe(true);
  });

  it("increases balance for income", () => {
    const next = applyTransactionToBalance(100000, {
      amountMinor: 50000,
      direction: "credit",
      transactionType: "income",
      status: "confirmed",
    });
    expect(next).toBe(150000);
  });

  it("does not treat transfers as spending", () => {
    const transfer = {
      transactionType: "transfer" as const,
      status: "confirmed" as const,
      direction: "debit" as const,
      amountMinor: 10000,
    };
    expect(appliesToSpending(transfer)).toBe(false);
    expect(
      applyTransactionToBalance(50000, {
        ...transfer,
      }),
    ).toBe(40000);
  });

  it("builds balance from checkpoint + subsequent sequence", () => {
    const checkpoint = {
      id: "c1",
      userId: "u1",
      accountId: "a1",
      balanceMinor: 1075804,
      currency: "THB" as const,
      verifiedAt: "2026-08-09T09:00:00.000Z",
      source: "sms",
      sourceObservationId: null,
      note: null,
      createdAt: "2026-08-09T09:00:00.000Z",
    };

    const mk = (id: string, amount: number, at: string) => ({
      id,
      userId: "u1",
      accountId: "a1",
      counterAccountId: null,
      direction: "debit" as const,
      transactionType: "expense" as const,
      amountMinor: amount,
      currency: "THB" as const,
      occurredAt: at,
      description: id,
      merchant: null,
      category: null,
      source: "screenshot" as const,
      status: "confirmed" as const,
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      transferGroupId: null,
      syncStatus: "synced" as const,
      createdAt: at,
      updatedAt: at,
    });

    const balance = calculateAccountBalance({
      checkpoint,
      transactionsAfterCheckpoint: [
        mk("a", 6500, "2026-08-09T09:01:00.000Z"),
        mk("b", 3500, "2026-08-09T09:02:00.000Z"),
        mk("c", 60000, "2026-08-09T09:03:00.000Z"),
      ],
    });

    // 1075804 - 6500 - 3500 - 60000 = 1005804
    expect(balance?.amountMinor).toBe(1005804);
  });
});

describe("safe-to-spend", () => {
  it("spreads free money across days until income", () => {
    const result = calculateSafeToSpend({
      available: money(2150000, "THB"),
      reserved: money(0, "THB"),
      safetyBuffer: money(0, "THB"),
      daysUntilNextIncome: 17,
    });
    expect(result.today.amountMinor).toBe(Math.floor(2150000 / 17));
    expect(result.today.amountMinor).toBeGreaterThan(0);
  });

  it("clamps negative free cash to zero", () => {
    const result = calculateSafeToSpend({
      available: money(10000, "THB"),
      reserved: money(20000, "THB"),
      safetyBuffer: money(5000, "THB"),
      daysUntilNextIncome: 10,
    });
    expect(result.free.amountMinor).toBe(0);
    expect(result.today.amountMinor).toBe(0);
  });

  it("recalculates after overspend instead of failing hard", () => {
    const after = recalculateAfterSpend(
      {
        available: money(1700000, "THB"),
        reserved: money(0, "THB"),
        safetyBuffer: money(0, "THB"),
        daysUntilNextIncome: 10,
      },
      money(200000, "THB"),
    );
    expect(after.messageKey).toBe("over_today");
    expect(after.overTodayPlan?.amountMinor).toBeGreaterThan(0);
    expect(after.today.amountMinor).toBeGreaterThanOrEqual(0);
  });
});

describe("fingerprints", () => {
  it("does not rely on amount alone", () => {
    const a = buildTransactionFingerprint({
      institution: "Bangkok Bank",
      maskedAccount: "X6591",
      direction: "debit",
      amountMinor: 6500,
      balanceAfterMinor: 1069304,
      channel: "mobile",
    });
    const b = buildTransactionFingerprint({
      institution: "Bangkok Bank",
      maskedAccount: "X6591",
      direction: "debit",
      amountMinor: 6500,
      balanceAfterMinor: 1050000,
      channel: "mobile",
    });
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(a.confidence).toBe("high");
    expect(matchFingerprint(a.fingerprint, [a.fingerprint]).kind).toBe("exact");
  });
});

describe("bangkok bank text parser", () => {
  it("parses western bank amount strings into minor units", () => {
    expect(majorStringToMinor("10,058.04")).toBe(1005804);
    expect(majorStringToMinor("750.00")).toBe(75000);
  });

  it("extracts debit + balance-after from SMS-like text", () => {
    const parser = new BangkokBankSmsParser();
    const parsed = parser.parse({
      institution: "Bangkok Bank",
      text: "Withdrawal/transfer/payment from your account X6591 of Bt 65.00 via MOBILE; the available balance is Bt 10,693.04.",
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.amountMinor).toBe(6500);
    expect(parsed[0]?.balanceAfterMinor).toBe(1069304);
    expect(parsed[0]?.direction).toBe("debit");
  });
});
