
import { describe, expect, it } from "vitest";
import { computeFinanceRevision } from "./finance-revision";
import type { PlanItem } from "./types";

function item(partial: Partial<PlanItem> & Pick<PlanItem, "id" | "amountMinor">): PlanItem {
  return {
    id: partial.id,
    userId: "u1",
    name: partial.name ?? "X",
    kind: partial.kind ?? "mandatory",
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: "monthly",
    nextDueAt: "2026-08-28T12:00:00.000Z",
    isActive: true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-08-01T00:00:00.000Z",
  };
}

describe("computeFinanceRevision", () => {
  it("changes when a plan expense is settled (paid moves off reservation)", () => {
    const unpaid = [
      item({ id: "rent", amountMinor: 30_000_00, kind: "mandatory", name: "Hyra" }),
    ];
    const paid = [
      item({
        id: "rent",
        amountMinor: 30_000_00,
        kind: "mandatory",
        name: "Hyra",
        settledMinor: 30_000_00,
        settledAt: "2026-08-26T08:00:00.000Z",
        updatedAt: "2026-08-26T08:00:00.000Z",
      }),
    ];
    const a = computeFinanceRevision({
      planItems: unpaid,
      ledgerTransactions: [],
      calculatedBalanceMinor: 100_000_00,
      cycleSpendingMinor: 0,
      todaySpendingMinor: 0,
    });
    const b = computeFinanceRevision({
      planItems: paid,
      ledgerTransactions: [
        {
          id: "tx1",
          updatedAt: "2026-08-26T08:00:00.000Z",
          amountMinor: 30_000_00,
        },
      ],
      calculatedBalanceMinor: 70_000_00,
      cycleSpendingMinor: 30_000_00,
      todaySpendingMinor: 0,
    });
    expect(a).not.toBe(b);
  });
});
