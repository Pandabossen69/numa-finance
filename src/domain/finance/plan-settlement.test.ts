import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/domain/finance";
import {
  planAmountBelowSettledError,
  previewAdditionalPartialRemaining,
  remainingOpenMinor,
  resolveAdditionalSettlement,
  settledAmountMinor,
} from "@/domain/finance/plan-months";
import { planSettleTargetMinor } from "@/domain/finance/plan-settle-ledger";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor" | "name">,
): PlanItem {
  return {
    id: partial.id ?? "00000000-0000-4000-8000-000000000001",
    userId: "u1",
    name: partial.name,
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: partial.cadence ?? "monthly",
    nextDueAt: partial.nextDueAt ?? "2026-09-15T12:00:00.000Z",
    isActive: partial.isActive ?? true,
    settledAt: partial.settledAt ?? null,
    settledMinor: partial.settledMinor ?? null,
    remainingDueAt: partial.remainingDueAt ?? null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("additional partial settlement", () => {
  for (const [label, cadence] of [
    ["income", "income"],
    ["expense", "monthly"],
  ] as const) {
    it(`${label}: 10k open → +3k → +2k → +1.5k → mark remainder`, () => {
      const planned = 10_000_00;
      let settled = 0;

      const first = resolveAdditionalSettlement({
        plannedMinor: planned,
        alreadySettledMinor: settled,
        additionalMinor: 3_000_00,
      });
      expect(first).toMatchObject({
        ok: true,
        targetSettledMinor: 3_000_00,
        remainingMinor: 7_000_00,
        fullySettled: false,
      });
      if (!first.ok) return;
      settled = first.targetSettledMinor;

      const second = resolveAdditionalSettlement({
        plannedMinor: planned,
        alreadySettledMinor: settled,
        additionalMinor: 2_000_00,
      });
      expect(second).toMatchObject({
        ok: true,
        targetSettledMinor: 5_000_00,
        remainingMinor: 5_000_00,
      });
      if (!second.ok) return;
      settled = second.targetSettledMinor;

      const third = resolveAdditionalSettlement({
        plannedMinor: planned,
        alreadySettledMinor: settled,
        additionalMinor: 1_500_00,
      });
      expect(third).toMatchObject({
        ok: true,
        targetSettledMinor: 6_500_00,
        remainingMinor: 3_500_00,
      });
      if (!third.ok) return;
      settled = third.targetSettledMinor;

      const row = item({
        name: label,
        kind: label === "income" ? "expected" : "mandatory",
        amountMinor: planned,
        cadence,
        settledMinor: settled,
      });
      expect(remainingOpenMinor(row)).toBe(3_500_00);
      expect(planSettleTargetMinor(row, { settled: true })).toBe(planned);
    });
  }

  it("additional === remaining → fully settled", () => {
    expect(
      resolveAdditionalSettlement({
        plannedMinor: 10_000_00,
        alreadySettledMinor: 6_500_00,
        additionalMinor: 3_500_00,
      }),
    ).toEqual({
      ok: true,
      targetSettledMinor: 10_000_00,
      remainingMinor: 0,
      fullySettled: true,
    });
  });

  it("additional > remaining → rejected", () => {
    const result = resolveAdditionalSettlement({
      plannedMinor: 10_000_00,
      alreadySettledMinor: 6_500_00,
      additionalMinor: 4_000_00,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/kvar/i);
  });

  it("additional <= 0 → rejected", () => {
    expect(
      resolveAdditionalSettlement({
        plannedMinor: 10_000_00,
        alreadySettledMinor: 0,
        additionalMinor: 0,
      }).ok,
    ).toBe(false);
  });

  it("preview shows cumulative equation for additional input", () => {
    expect(
      previewAdditionalPartialRemaining(10_000_00, 3_000_00, 2_000_00),
    ).toEqual({
      totalMinor: 10_000_00,
      settledMinor: 5_000_00,
      remainingMinor: 5_000_00,
    });
    expect(
      previewAdditionalPartialRemaining(10_000_00, 3_000_00, 8_000_00),
    ).toBeNull();
  });

  it("edit planned below settled → Swedish error", () => {
    const income = item({
      name: "Lön",
      kind: "expected",
      amountMinor: 10_000_00,
      cadence: "income",
      settledMinor: 6_000_00,
    });
    expect(settledAmountMinor(income)).toBe(6_000_00);
    const incomeErr = planAmountBelowSettledError(income, 4_000_00);
    expect(incomeErr).toBeTruthy();
    expect(incomeErr!).toContain("mottaget");
    expect(incomeErr!).toContain("6");

    const expense = item({
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10_000_00,
      cadence: "monthly",
      settledMinor: 6_000_00,
    });
    const expenseErr = planAmountBelowSettledError(expense, 4_000_00);
    expect(expenseErr).toBeTruthy();
    expect(expenseErr!).toContain("betalat");
    expect(planAmountBelowSettledError(income, 8_000_00)).toBeNull();
  });

  it("ledger target stays cumulative (no double cash on step-up)", () => {
    const row = item({
      name: "CSN",
      kind: "expected",
      amountMinor: 10_000_00,
      cadence: "income",
      settledMinor: 3_000_00,
    });
    expect(
      planSettleTargetMinor(row, {
        settled: true,
        requestedMinor: 5_000_00,
      }),
    ).toBe(5_000_00);
    expect(
      planSettleTargetMinor(row, {
        settled: true,
        requestedMinor: 10_000_00,
      }),
    ).toBe(10_000_00);
    expect(planSettleTargetMinor(row, { settled: false })).toBe(0);
  });
});
