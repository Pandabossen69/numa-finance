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
});
