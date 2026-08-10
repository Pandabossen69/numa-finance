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
    expect(totals.reservedPlannedMinor).toBe(12000_00);
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

  it("reduces reserved when matching expense already paid", () => {
    const rent = item({
      id: "rent",
      name: "Hyra",
      kind: "mandatory",
      amountMinor: 10000_00,
    });
    const food = item({
      id: "food",
      name: "Mat",
      kind: "expected",
      amountMinor: 3000_00,
    });

    const totals = calculatePlanTotals(
      [rent, food, item({ kind: "buffer", amountMinor: 500_00 })],
      "THB",
      new Date("2026-08-10T00:00:00.000Z"),
      17,
      [
        {
          amountMinor: 10000_00,
          description: "Hyra augusti",
          category: "Boende",
          currency: "THB",
          transactionType: "expense",
          status: "confirmed",
        },
      ],
    );

    // Rent satisfied via Boende → mandatory allocation; food still reserved.
    expect(totals.reservedPlannedMinor).toBe(13000_00);
    expect(totals.reservedMinor).toBe(3000_00);
    expect(totals.bufferMinor).toBe(500_00);
    const rentRemaining = totals.itemRemaining.find((r) => r.itemId === "rent");
    expect(rentRemaining?.remainingMinor).toBe(0);
    expect(rentRemaining?.spentMinor).toBe(10000_00);
  });

  it("exact name match prefers the named bucket", () => {
    const totals = calculatePlanTotals(
      [
        item({
          id: "a",
          name: "Netflix",
          kind: "mandatory",
          amountMinor: 200_00,
        }),
        item({
          id: "b",
          name: "Hyra",
          kind: "mandatory",
          amountMinor: 10000_00,
        }),
      ],
      "THB",
      new Date(),
      17,
      [
        {
          amountMinor: 200_00,
          description: "Netflix",
          category: "Räkning",
          currency: "THB",
          transactionType: "expense",
          status: "confirmed",
        },
      ],
    );
    expect(totals.reservedMinor).toBe(10000_00);
    expect(
      totals.itemRemaining.find((r) => r.itemId === "a")?.remainingMinor,
    ).toBe(0);
  });
});
