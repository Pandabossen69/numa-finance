import { describe, expect, it } from "vitest";
import { calculatePlanTotals } from "./plan-totals";
import type { PlanItem } from "./types";

function item(
  partial: Partial<PlanItem> & Pick<PlanItem, "kind" | "amountMinor">,
): PlanItem {
  return {
    id: partial.id ?? crypto.randomUUID(),
    userId: "u1",
    name: partial.name ?? "x",
    kind: partial.kind,
    amountMinor: partial.amountMinor,
    currency: "THB",
    cadence: "monthly",
    nextDueAt: partial.nextDueAt ?? null,
    isActive: partial.isActive ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("calculatePlanTotals", () => {
  it("splits reserved, buffer and flexible", () => {
    const totals = calculatePlanTotals(
      [
        item({ kind: "mandatory", amountMinor: 10000_00 }),
        item({ kind: "goal", amountMinor: 2000_00 }),
        item({ kind: "buffer", amountMinor: 500_00 }),
        item({ kind: "flexible", amountMinor: 3000_00 }),
      ],
      "THB",
    );
    expect(totals.reservedMinor).toBe(12000_00);
    expect(totals.bufferMinor).toBe(500_00);
    expect(totals.flexibleMinor).toBe(3000_00);
  });

  it("uses soonest nextDueAt for runway days", () => {
    const now = new Date("2026-08-10T00:00:00.000Z");
    const totals = calculatePlanTotals(
      [
        item({
          kind: "expected",
          amountMinor: 0,
          nextDueAt: "2026-08-20T00:00:00.000Z",
        }),
      ],
      "THB",
      now,
      17,
    );
    expect(totals.daysUntilNextIncome).toBe(10);
  });
});
