import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findMonthSavings,
  MONTHLY_SAVE_NAME,
  monthAnchorIso,
  nextMonthSavingsMutation,
  savingsByMonthKeys,
  type PlanItem,
} from "@/domain/finance";

const MONTH = "2026-10";
const TZ = "Asia/Bangkok";

function row(
  id: string,
  amountMinor: number,
  isActive: boolean,
  updatedAt: string,
): PlanItem {
  return {
    id,
    userId: "u",
    name: MONTHLY_SAVE_NAME,
    kind: "goal",
    amountMinor,
    currency: "THB",
    cadence: "savings",
    nextDueAt: monthAnchorIso(MONTH),
    isActive,
    createdAt: updatedAt,
    updatedAt,
  };
}

/** Same deactivate-or-reuse steps as setMonthSavingsAction, in memory. */
function applyRound(items: PlanItem[], amountMinor: number, stamp: string): PlanItem[] {
  const decision = nextMonthSavingsMutation({
    items,
    monthKey: MONTH,
    timeZone: TZ,
    amountMinor,
  });
  if (decision.kind === "clear") {
    return items.map((item) =>
      decision.ids.includes(item.id)
        ? { ...item, isActive: false, updatedAt: stamp }
        : item,
    );
  }
  if (decision.kind === "create") {
    return [...items, row(`created-${items.length + 1}`, amountMinor, true, stamp)];
  }
  return items.map((item) =>
    item.id === decision.id
      ? { ...item, amountMinor, isActive: true, updatedAt: stamp }
      : item,
  );
}

describe("Sätt av + Nollställ reuses one month row", () => {
  it("three rounds leave at most one row for the month", () => {
    let items: PlanItem[] = [];
    for (let round = 1; round <= 3; round++) {
      items = applyRound(items, 20_000 + round, `2026-10-03T12:00:0${round}.000Z`);
      items = applyRound(items, 0, `2026-10-03T12:00:1${round}.000Z`);
    }
    const monthRows = items.filter((item) => item.nextDueAt?.startsWith(MONTH));
    expect(monthRows).toHaveLength(1);
    expect(monthRows[0]?.isActive).toBe(false);
    expect(findMonthSavings(items, MONTH, TZ)).toBeUndefined();
    expect(savingsByMonthKeys(items, [MONTH], TZ)[MONTH]).toBe(0);
  });

  it("the next Sätt av reactivates that row and rollup sees only it", () => {
    let items: PlanItem[] = [];
    items = applyRound(items, 500, "2026-10-03T12:00:01.000Z");
    items = applyRound(items, 0, "2026-10-03T12:00:02.000Z");
    const id = items[0]?.id;
    items = applyRound(items, 900, "2026-10-03T12:00:03.000Z");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(id);
    expect(findMonthSavings(items, MONTH, TZ)?.amountMinor).toBe(900);
    expect(savingsByMonthKeys(items, [MONTH], TZ)[MONTH]).toBe(900);
  });

  it("setMonthSavingsAction reuses an inactive row instead of inserting", () => {
    const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
    expect(actions).toContain("nextMonthSavingsMutation");
    expect(actions).toContain("listInactivePlanItems");
    expect(actions).toContain("isActive: true");
    const createAt = actions.indexOf('name: "Spara denna månad"');
    const reuseAt = actions.indexOf("decision.reactivate");
    expect(createAt).toBeGreaterThan(reuseAt);
  });
});
