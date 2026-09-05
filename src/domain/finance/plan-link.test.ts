import { describe, expect, it } from "vitest";
import { projectCashCoverage } from "./cash-coverage";
import { suggestPlanLinks } from "./plan-link";
import { planItemAlreadyFundedInLedger } from "./plan-settle-ledger";
import type { CanonicalTransaction, PlanItem } from "./types";

const tz = "Asia/Bangkok";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: crypto.randomUUID(),
    userId: "u1",
    currency: "THB",
    cadence: "monthly",
    nextDueAt: "2026-08-25T12:00:00.000Z",
    isActive: true,
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

function tx(
  partial: Partial<CanonicalTransaction> &
    Pick<CanonicalTransaction, "id" | "amountMinor" | "occurredAt">,
): CanonicalTransaction {
  return {
    userId: "u1",
    accountId: "a1",
    counterAccountId: null,
    currency: "THB",
    description: partial.description ?? "köp",
    merchant: null,
    category: null,
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    syncStatus: "saved",
    createdAt: partial.occurredAt,
    updatedAt: partial.occurredAt,
    transferGroupId: null,
    planItemId: null,
    ledgerOrigin: "external",
    linkedPlanItemId: null,
    direction: "debit",
    transactionType: "expense",
    source: "sms",
    ...partial,
  };
}

describe("explicit plan linking", () => {
  it("suggests similar amounts within ±7 days but does not drop unpaid", () => {
    const hyra = item({
      id: "hyra",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10_000_00,
      nextDueAt: "2026-08-25T12:00:00.000Z",
    });
    const el = item({
      id: "el",
      name: "El",
      kind: "mandatory",
      amountMinor: 10_000_00,
      nextDueAt: "2026-08-27T12:00:00.000Z",
    });
    const bank = tx({
      id: "sms-10k",
      amountMinor: 10_000_00,
      occurredAt: "2026-08-26T09:00:00.000Z",
      description: "BETALNING",
    });
    const suggestions = suggestPlanLinks({
      items: [hyra, el],
      transactions: [bank],
      kind: "expense",
      monthKey: "2026-08",
      timeZone: tz,
    });
    expect(suggestions).toHaveLength(1);
    const coverage = projectCashCoverage({
      planItems: [hyra, el],
      transactions: [bank],
      monthKey: "2026-08",
      timeZone: tz,
      saldoMinor: 40_000_00,
    });
    expect(coverage.unpaidMinor).toBe(20_000_00);
    expect(
      planItemAlreadyFundedInLedger({
        item: hyra,
        planItems: [hyra, el],
        transactions: [bank],
        kind: "expense",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
    expect(
      planItemAlreadyFundedInLedger({
        item: el,
        planItems: [hyra, el],
        transactions: [bank],
        kind: "expense",
        monthKey: "2026-08",
        timeZone: tz,
      }),
    ).toBe(false);
  });

  it("suggests several partial external payments against one open bill", () => {
    const bill = item({
      id: "nota",
      name: "Testnota 20k",
      kind: "mandatory",
      amountMinor: 20_000_00,
      nextDueAt: "2026-09-04T12:00:00.000Z",
    });
    const first = tx({
      id: "pay-5a",
      amountMinor: 5_000_00,
      occurredAt: "2026-09-04T09:00:00.000Z",
      description: "Testnota del 1",
    });
    const second = tx({
      id: "pay-5b",
      amountMinor: 5_000_00,
      occurredAt: "2026-09-04T10:00:00.000Z",
      description: "Testnota del 2",
    });
    const last = tx({
      id: "pay-10",
      amountMinor: 10_000_00,
      occurredAt: "2026-09-04T11:00:00.000Z",
      description: "Testnota del 3",
    });
    const suggestions = suggestPlanLinks({
      items: [bill],
      transactions: [first, second, last],
      kind: "expense",
      monthKey: "2026-09",
      timeZone: tz,
    });
    expect(suggestions.map((row) => row.transactionId).sort()).toEqual([
      "pay-10",
      "pay-5a",
      "pay-5b",
    ]);
    expect(new Set(suggestions.map((row) => row.planItemId))).toEqual(
      new Set(["nota"]),
    );
  });

  it("still suggests a real SMS after synthetic full settlement", () => {
    const bill = item({
      id: "sms-nota",
      name: "Testnota SMS 20k",
      kind: "mandatory",
      amountMinor: 20_000_00,
      nextDueAt: "2026-09-04T12:00:00.000Z",
      settledAt: "2026-09-04T08:00:00.000Z",
      settledMinor: 20_000_00,
    });
    const real = tx({
      id: "sms-20k",
      amountMinor: 20_000_00,
      occurredAt: "2026-09-04T09:00:00.000Z",
      description: "Testnota SMS 20k",
    });
    const suggestions = suggestPlanLinks({
      items: [bill],
      transactions: [real],
      kind: "expense",
      monthKey: "2026-09",
      timeZone: tz,
    });
    expect(suggestions).toEqual([
      expect.objectContaining({
        planItemId: "sms-nota",
        transactionId: "sms-20k",
      }),
    ]);
  });

  it("does not suggest lunch-sized amounts against a large remaining bill", () => {
    const bill = item({
      id: "hyra",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 20_000_00,
      nextDueAt: "2026-09-04T12:00:00.000Z",
    });
    const lunch = tx({
      id: "lunch",
      amountMinor: 120_00,
      occurredAt: "2026-09-04T09:00:00.000Z",
      description: "Lunch",
    });
    expect(
      suggestPlanLinks({
        items: [bill],
        transactions: [lunch],
        kind: "expense",
        monthKey: "2026-09",
        timeZone: tz,
      }),
    ).toEqual([]);
  });
});
