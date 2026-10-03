import { describe, expect, it } from "vitest";
import {
  planWealthTotalMinor,
  projectCashCoverage,
  projectPayCycle,
  type PlanItem,
} from "@/domain/finance";

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
    settledAt: null,
    settledMinor: null,
    remainingDueAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-09-01T00:00:00.000Z",
  };
}

const SALDO = 50_000_00;

describe("Plan + sparande rollup", () => {
  it("sums 2 000 sparpost + 1 000 avsättning once, not twice", () => {
    const sparpost = item({
      id: "sparpost",
      name: "Spara denna månad",
      kind: "goal",
      amountMinor: 2_000_00,
      cadence: "savings",
      nextDueAt: "2026-09-15T12:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    });
    const avsatt = item({
      id: "avsatt",
      name: "Spara denna månad",
      kind: "goal",
      amountMinor: 1_000_00,
      cadence: "savings",
      nextDueAt: "2026-10-15T12:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const coverage = projectCashCoverage({
      planItems: [sparpost, avsatt],
      transactions: [],
      monthKey: "2026-10",
      timeZone: tz,
      saldoMinor: SALDO,
    });

    expect(coverage.savingsPriorMinor).toBe(2_000_00);
    expect(coverage.savingsThisMonthMinor).toBe(1_000_00);
    expect(coverage.reservedSavingsMinor).toBe(3_000_00);
    expect(coverage.reservedSavingsMinor).not.toBe(6_000_00);
    expect(coverage.unpaidMinor).toBe(0);

    const rollup = planWealthTotalMinor(
      coverage.overMinor,
      coverage.reservedSavingsMinor,
    );
    expect(rollup).toBe(SALDO);
    expect(rollup).not.toBe(SALDO + 3_000_00);
    expect(rollup).not.toBe(SALDO + 6_000_00);
  });

  it("does not add a replaced sparpost on top of the new avsättning", () => {
    const stale = item({
      id: "stale",
      name: "Spara denna månad",
      kind: "goal",
      amountMinor: 2_000_00,
      cadence: "savings",
      nextDueAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const current = item({
      id: "current",
      name: "Spara denna månad",
      kind: "goal",
      amountMinor: 1_000_00,
      cadence: "savings",
      nextDueAt: "2026-10-16T12:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    const items = [
      item({
        name: "Lön sep",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-09-25T12:00:00.000Z",
      }),
      item({
        name: "Lön okt",
        kind: "expected",
        amountMinor: 40_000_00,
        cadence: "income",
        nextDueAt: "2026-10-25T12:00:00.000Z",
      }),
      stale,
      current,
    ];
    const coverage = projectCashCoverage({
      planItems: items,
      transactions: [],
      monthKey: "2026-10",
      timeZone: tz,
      saldoMinor: SALDO,
    });
    expect(coverage.reservedSavingsMinor).toBe(1_000_00);
    expect(coverage.reservedSavingsMinor).not.toBe(3_000_00);

    const cycle = projectPayCycle(
      items,
      new Date("2026-10-03T05:00:00.000Z"),
      tz,
    );
    expect(cycle.remainingSavingsMinor).toBe(1_000_00);
    expect(cycle.remainingSavingsMinor).not.toBe(3_000_00);
  });
});
