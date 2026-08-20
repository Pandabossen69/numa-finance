import { describe, expect, it } from "vitest";
import type { CanonicalTransaction, PlanItem } from "./types";
import {
  extraSaldoHintSv,
  monthLeftoverHintSv,
  monthLivingSaldoMinor,
  projectExtraSaldo,
  spendingByMonthKey,
} from "./month-carryover";

const tz = "Asia/Bangkok";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? null,
    isActive: partial.isActive ?? true,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function expense(id: string, amountMinor: number, occurredAt: string): CanonicalTransaction {
  return {
    id,
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: "köp",
    merchant: null,
    category: null,
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    syncStatus: "saved",
    createdAt: occurredAt,
    updatedAt: occurredAt,
    transferGroupId: null,
    amountMinor,
    occurredAt,
    direction: "debit",
    transactionType: "expense",
    source: "manual",
  };
}

const plan = [
  item({
    name: "Lön",
    kind: "expected",
    amountMinor: 40_000_00,
    cadence: "income",
    nextDueAt: "2026-08-25T05:00:00.000Z",
  }),
  item({
    name: "Lön",
    kind: "expected",
    amountMinor: 40_000_00,
    cadence: "income",
    nextDueAt: "2026-09-25T05:00:00.000Z",
  }),
  item({
    name: "Lön",
    kind: "expected",
    amountMinor: 40_000_00,
    cadence: "income",
    nextDueAt: "2026-10-25T05:00:00.000Z",
  }),
  item({
    name: "Hyra",
    kind: "mandatory",
    amountMinor: 15_000_00,
    nextDueAt: "2026-08-01T00:00:00.000Z",
  }),
];

describe("month extra saldo carry-over", () => {
  it("groups spending on Bangkok calendar months, not UTC slices", () => {
    // 00:30 Bangkok Sep 1 = Aug 31 17:30 UTC
    const txs = [
      expense("a", 1_000_00, "2026-08-31T16:30:00.000Z"),
      expense("b", 2_000_00, "2026-08-31T17:30:00.000Z"),
    ];
    const byMonth = spendingByMonthKey({
      transactions: txs,
      currency: "THB",
      timeZone: tz,
    });
    expect(byMonth["2026-08"]).toBe(1_000_00);
    expect(byMonth["2026-09"]).toBe(2_000_00);
  });

  it("keeps leftover in the open month until the next month", () => {
    const spending = { "2026-08": 10_000_00 };
    const aug = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-08",
      currentMonthKey: "2026-08",
      timeZone: tz,
    });
    // 40k income − 15k rent − 10k spent = 15k leftover, not yet extra.
    expect(aug.planFreeMinor).toBe(25_000_00);
    expect(aug.monthResultMinor).toBe(15_000_00);
    expect(aug.extraSaldoMinor).toBe(0);
    expect(aug.nextMonthExtraMinor).toBe(15_000_00);
    expect(monthLeftoverHintSv(aug, "2026-08")).toMatch(/september/i);
    expect(monthLivingSaldoMinor(aug)).toBe(15_000_00);
  });

  it("shows August leftover as extra saldo on September", () => {
    const spending = { "2026-08": 10_000_00 };
    const sep = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-09",
      currentMonthKey: "2026-08",
      timeZone: tz,
    });
    expect(sep.extraSaldoMinor).toBe(15_000_00);
    expect(sep.carriedInMinor).toBe(15_000_00);
    expect(sep.spentMinor).toBe(0);
    expect(sep.monthResultMinor).toBe(25_000_00);
    // Future unused plan must not inflate extra further.
    expect(sep.nextMonthExtraMinor).toBe(15_000_00);
    expect(monthLivingSaldoMinor(sep)).toBe(40_000_00);
  });

  it("draws from extra saldo when the month is minus", () => {
    const spending = {
      "2026-08": 10_000_00,
      "2026-09": 32_000_00,
    };
    const sep = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-09",
      currentMonthKey: "2026-09",
      timeZone: tz,
    });
    // Sep plan free 25k − 32k spent = −7k, covered by 15k extra → 8k left.
    expect(sep.monthResultMinor).toBe(-7_000_00);
    expect(sep.drawnMinor).toBe(7_000_00);
    expect(sep.extraSaldoMinor).toBe(8_000_00);
    expect(sep.nextMonthExtraMinor).toBe(8_000_00);
    expect(extraSaldoHintSv(sep, "2026-09")).toBe("Minus tas från extra saldo");
    expect(monthLivingSaldoMinor(sep)).toBe(8_000_00);
  });

  it("floors extra at zero when the deficit is larger than leftover", () => {
    const spending = {
      "2026-08": 10_000_00,
      "2026-09": 50_000_00,
    };
    const sep = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-09",
      currentMonthKey: "2026-09",
      timeZone: tz,
    });
    expect(sep.drawnMinor).toBe(15_000_00);
    expect(sep.extraSaldoMinor).toBe(0);
    expect(sep.nextMonthExtraMinor).toBe(0);

    const oct = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-10",
      currentMonthKey: "2026-09",
      timeZone: tz,
    });
    expect(oct.extraSaldoMinor).toBe(0);
    expect(monthLivingSaldoMinor(sep)).toBe(-10_000_00);
  });

  it("lets leftover follow month after month", () => {
    const spending = {
      "2026-08": 20_000_00,
      "2026-09": 20_000_00,
    };
    const oct = projectExtraSaldo({
      planItems: plan,
      spendingByMonthKey: spending,
      monthKey: "2026-10",
      currentMonthKey: "2026-10",
      timeZone: tz,
    });
    // Aug 5k + Sep 5k = 10k extra sitting on October.
    expect(oct.extraSaldoMinor).toBe(10_000_00);
  });

  it("ignores bank-SMS credits and voided rows in month spend", () => {
    const txs: CanonicalTransaction[] = [
      {
        ...expense("sms", 3_400_00, "2026-08-12T04:00:00.000Z"),
        source: "screenshot",
        fingerprint: "sms:kbank:1",
      },
      {
        ...expense("void", 9_000_00, "2026-08-12T05:00:00.000Z"),
        status: "voided",
      },
    ];
    const byMonth = spendingByMonthKey({
      transactions: txs,
      currency: "THB",
      timeZone: tz,
    });
    expect(byMonth["2026-08"]).toBe(3_400_00);
  });
});
