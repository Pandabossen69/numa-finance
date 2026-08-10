import { describe, expect, it } from "vitest";
import type { PlanItem } from "./types";
import {
  isRecurringMonthly,
  projectPlanForMonth,
  rollDueDateForward,
  withRolledMonthlyDues,
} from "./plan-months";

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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("plan-months", () => {
  it("treats mandatory as recurring monthly", () => {
    expect(
      isRecurringMonthly(
        item({ name: "Hyra", kind: "mandatory", amountMinor: 100_00 }),
      ),
    ).toBe(true);
  });

  it("projects fixed expenses into future months", () => {
    const items = [
      item({
        name: "Hyra",
        kind: "mandatory",
        amountMinor: 15_000_00,
        nextDueAt: "2026-08-01T00:00:00.000Z",
      }),
      item({
        name: "Engång",
        kind: "flexible",
        amountMinor: 500_00,
        cadence: "once",
        nextDueAt: "2026-08-15T00:00:00.000Z",
      }),
    ];

    const aug = projectPlanForMonth(items, "2026-08", "UTC");
    const sep = projectPlanForMonth(items, "2026-09", "UTC");

    expect(aug.items.map((i) => i.name)).toEqual(["Hyra", "Engång"]);
    expect(sep.items.map((i) => i.name)).toEqual(["Hyra"]);
    expect(sep.reservedMinor).toBe(15_000_00);
  });

  it("rolls overdue monthly dues forward", () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    const overdue = item({
      name: "Netflix",
      kind: "mandatory",
      amountMinor: 199_00,
      nextDueAt: "2026-06-01T00:00:00.000Z",
    });
    const { changed, items } = withRolledMonthlyDues([overdue], now);
    expect(changed).toHaveLength(1);
    expect(items[0]!.nextDueAt).toBe(rollDueDateForward(overdue.nextDueAt!, now));
    expect(new Date(items[0]!.nextDueAt!).getTime()).toBeGreaterThanOrEqual(
      now.getTime(),
    );
  });
});
