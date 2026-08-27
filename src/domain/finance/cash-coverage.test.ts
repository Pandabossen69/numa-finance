import { describe, expect, it } from "vitest";
import {
  CASH_COVERAGE_HINT_SV,
  matchPlanItemsToLedger,
  projectCashCoverage,
} from "./cash-coverage";
import { monthLivingSaldoMinor, projectExtraSaldo } from "./month-carryover";
import type { CanonicalTransaction, PlanItem } from "./types";

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
    settledAt: partial.settledAt ?? null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function tx(
  partial: Pick<CanonicalTransaction, "id" | "amountMinor" | "occurredAt"> &
    Partial<CanonicalTransaction>,
): CanonicalTransaction {
  const occurredAt = partial.occurredAt;
  return {
    id: partial.id,
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: partial.merchant ?? null,
    category: null,
    status: partial.status ?? "confirmed",
    balanceAfterMinor: partial.balanceAfterMinor ?? null,
    fingerprint: partial.fingerprint ?? null,
    sourceObservationId: partial.sourceObservationId ?? null,
    syncStatus: "saved",
    createdAt: occurredAt,
    updatedAt: occurredAt,
    transferGroupId: null,
    amountMinor: partial.amountMinor,
    occurredAt,
    direction: partial.direction ?? "debit",
    transactionType: partial.transactionType ?? "expense",
    source: partial.source ?? "manual",
  };
}

describe("projectCashCoverage", () => {
  it("Över = saldo + remaining income − remaining unpaid expenses", () => {
    const items = [
      item({
        id: "inc",
        name: "Trukks",
        kind: "expected",
        amountMinor: 100_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
      }),
      item({
        id: "bill",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 20_000_00,
        nextDueAt: "2026-08-30T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 15_000_00,
    });
    expect(view.incomingMinor).toBe(100_000_00);
    expect(view.unpaidMinor).toBe(20_000_00);
    expect(view.overMinor).toBe(15_000_00 + 100_000_00 - 20_000_00);
    expect(view.overMinor).toBe(95_000_00);
    expect(CASH_COVERAGE_HINT_SV).toMatch(/Saldo \+ kommer in/);
  });

  it("does not subtract a paid plan expense again after it hits the ledger", () => {
    const items = [
      item({
        id: "netflix",
        name: "Netflix",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-08-10T05:00:00.000Z",
      }),
      item({
        id: "el",
        name: "El",
        kind: "mandatory",
        amountMinor: 8_000_00,
        nextDueAt: "2026-08-28T05:00:00.000Z",
      }),
    ];
    const paid = tx({
      id: "tx-netflix",
      amountMinor: 10_000_00,
      occurredAt: "2026-08-10T08:00:00.000Z",
      description: "Netflix",
      direction: "debit",
      transactionType: "expense",
    });
    const view = projectCashCoverage({
      planItems: items,
      transactions: [paid],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 50_000_00,
    });
    expect(view.unpaidMinor).toBe(8_000_00);
    expect(view.overMinor).toBe(42_000_00);
    // Old Mot planen hero would also subtract the 10k spend on top of plan expenses.
    const extra = projectExtraSaldo({
      planItems: items,
      spendingByMonthKey: { "2026-08": 10_000_00 },
      monthKey: "2026-08",
      currentMonthKey: "2026-08",
      timeZone: tz,
    });
    expect(monthLivingSaldoMinor(extra)).toBe(-18_000_00 - 10_000_00);
    expect(view.overMinor).not.toBe(monthLivingSaldoMinor(extra));
  });

  it("counts unpaid income dated today in Kommer in", () => {
    const items = [
      item({
        id: "trukks",
        name: "Trukks",
        kind: "expected",
        amountMinor: 134_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
      }),
      item({
        id: "faktura",
        name: "Faktura",
        kind: "mandatory",
        amountMinor: 40_000_00,
        nextDueAt: "2026-08-30T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 12_000_00,
    });
    expect(view.incomingMinor).toBe(134_000_00);
    expect(view.unpaidMinor).toBe(40_000_00);
    expect(view.overMinor).toBe(106_000_00);
    expect(view.overMinor).toBeGreaterThan(0);
  });

  it("is negative only when remaining bills exceed saldo + incoming", () => {
    const items = [
      item({
        id: "inc",
        name: "CSN",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
      }),
      item({
        id: "bill",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 40_000_00,
        nextDueAt: "2026-08-29T05:00:00.000Z",
      }),
    ];
    const short = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 5_000_00,
    });
    expect(short.overMinor).toBe(5_000_00 + 10_000_00 - 40_000_00);
    expect(short.overMinor).toBeLessThan(0);

    const covered = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 35_000_00,
    });
    expect(covered.overMinor).toBe(5_000_00);
    expect(covered.overMinor).toBeGreaterThan(0);
  });

  it("does not treat planned savings as kvar att betala", () => {
    const items = [
      item({
        id: "save",
        name: "Spara denna månad",
        kind: "goal",
        amountMinor: 25_000_00,
        cadence: "savings",
        nextDueAt: "2026-08-15T05:00:00.000Z",
      }),
      item({
        id: "bill",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 8_000_00,
        nextDueAt: "2026-08-28T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 20_000_00,
    });
    expect(view.unpaidMinor).toBe(8_000_00);
    expect(view.overMinor).toBe(12_000_00);
  });

  it("matches CSN plan vs actual with amount drift", () => {
    const items = [
      item({
        id: "csn",
        name: "CSN",
        kind: "expected",
        amountMinor: 57_500_00,
        cadence: "income",
        nextDueAt: "2026-08-25T05:00:00.000Z",
      }),
    ];
    const landed = tx({
      id: "tx-csn",
      amountMinor: 58_000_00,
      occurredAt: "2026-08-25T08:00:00.000Z",
      description: "CSN",
      direction: "credit",
      transactionType: "income",
    });
    const view = projectCashCoverage({
      planItems: items,
      transactions: [landed],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 58_000_00,
    });
    expect(view.incomingMinor).toBe(0);
    expect(view.overMinor).toBe(58_000_00);
  });

  it("drops received Trukks from Kommer in when a credit hits the ledger", () => {
    const items = [
      item({
        id: "trukks",
        name: "Trukks",
        kind: "expected",
        amountMinor: 134_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
      }),
      item({
        id: "bill",
        name: "Faktura",
        kind: "mandatory",
        amountMinor: 40_000_00,
        nextDueAt: "2026-08-30T05:00:00.000Z",
      }),
    ];
    const landed = tx({
      id: "tx-trukks",
      amountMinor: 134_000_00,
      occurredAt: "2026-08-27T09:00:00.000Z",
      description: "Trukks AB",
      direction: "credit",
      transactionType: "income",
      source: "sms",
      fingerprint: "sms|trukks|13400000",
      balanceAfterMinor: 150_000_00,
    });
    const view = projectCashCoverage({
      planItems: items,
      transactions: [landed],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 150_000_00,
    });
    expect(view.incomingMinor).toBe(0);
    expect(view.unpaidMinor).toBe(40_000_00);
    expect(view.overMinor).toBe(110_000_00);
  });

  it("does not assign the same ledger row to two plan items", () => {
    const items = [
      item({
        id: "a",
        name: "Faktura A",
        kind: "mandatory",
        amountMinor: 5_000_00,
        nextDueAt: "2026-08-20T05:00:00.000Z",
      }),
      item({
        id: "b",
        name: "Faktura B",
        kind: "mandatory",
        amountMinor: 5_000_00,
        nextDueAt: "2026-08-21T05:00:00.000Z",
      }),
    ];
    const onePayment = tx({
      id: "tx-one",
      amountMinor: 5_000_00,
      occurredAt: "2026-08-20T08:00:00.000Z",
      description: "Faktura A",
    });
    const matched = matchPlanItemsToLedger({
      items,
      transactions: [onePayment],
      kind: "expense",
      monthKey: "2026-08",
      timeZone: tz,
    });
    expect(matched.size).toBe(1);
    const view = projectCashCoverage({
      planItems: items,
      transactions: [onePayment],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 0,
    });
    expect(view.unpaidMinor).toBe(5_000_00);
  });

  it("treats missing saldo as 0 in Över without inventing a cash figure", () => {
    const items = [
      item({
        id: "inc",
        name: "Trukks",
        kind: "expected",
        amountMinor: 50_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
      }),
      item({
        id: "bill",
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 10_000_00,
        nextDueAt: "2026-08-30T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: null,
    });
    expect(view.saldoMinor).toBeNull();
    expect(view.overMinor).toBe(40_000_00);
  });

  it("drops a plan expense marked Klar even without a ledger row", () => {
    const items = [
      item({
        id: "oscar",
        name: "Oscar",
        kind: "expected",
        amountMinor: 3_000_00,
        cadence: "once",
        nextDueAt: "2026-08-20T05:00:00.000Z",
        settledAt: "2026-08-20T10:00:00.000Z",
      }),
      item({
        id: "gym",
        name: "Gym",
        kind: "mandatory",
        amountMinor: 1_400_00,
        nextDueAt: "2026-08-28T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 10_000_00,
    });
    expect(view.unpaidMinor).toBe(1_400_00);
    expect(view.overMinor).toBe(8_600_00);
  });

  it("drops a plan income marked Klar from Kommer in", () => {
    const items = [
      item({
        id: "trukks",
        name: "Trukks",
        kind: "expected",
        amountMinor: 51_000_00,
        cadence: "income",
        nextDueAt: "2026-08-27T05:00:00.000Z",
        settledAt: "2026-08-27T08:00:00.000Z",
      }),
      item({
        id: "csn",
        name: "CSN",
        kind: "expected",
        amountMinor: 10_000_00,
        cadence: "income",
        nextDueAt: "2026-08-30T05:00:00.000Z",
      }),
    ];
    const view = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 1_000_00,
    });
    expect(view.incomingMinor).toBe(10_000_00);
    expect(view.overMinor).toBe(11_000_00);
  });
});
