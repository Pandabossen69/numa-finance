import { describe, expect, it } from "vitest";
import { savedViewWithoutDrillFilters } from "./saved-view-drill";

const DRILL = { filter: "expense" as const, category: "Övrigt" };

describe("savedViewWithoutDrillFilters", () => {
  it("drops the drill's Utgifter chip and category and keeps Perioden", () => {
    const next = savedViewWithoutDrillFilters({
      before: { filter: "all", category: null },
      current: {
        filter: "expense",
        period: "cycle",
        category: "Övrigt",
        cycleStartAt: "2026-09-03T00:00:00.000Z",
        cycleEndAt: "2026-10-25T00:00:00.000Z",
      },
      drill: DRILL,
    });
    expect(next).toEqual({
      filter: "all",
      period: "cycle",
      category: null,
      cycleStartAt: "2026-09-03T00:00:00.000Z",
      cycleEndAt: "2026-10-25T00:00:00.000Z",
    });
  });

  it("restores Utgifter even after the category was already cleared", () => {
    const next = savedViewWithoutDrillFilters({
      before: { filter: "all", category: null },
      current: {
        filter: "expense",
        period: "cycle",
        category: null,
      },
      drill: DRILL,
    });
    expect(next.filter).toBe("all");
    expect(next.category).toBeNull();
    expect(next.period).toBe("cycle");
  });

  it("keeps Utgifter when the user had already chosen it", () => {
    const next = savedViewWithoutDrillFilters({
      before: { filter: "expense", category: null },
      current: {
        filter: "expense",
        period: "cycle",
        category: "Övrigt",
      },
      drill: DRILL,
    });
    expect(next.filter).toBe("expense");
    expect(next.category).toBeNull();
  });

  it("keeps a type chip the user changed away from the drill", () => {
    const next = savedViewWithoutDrillFilters({
      before: { filter: "all", category: null },
      current: {
        filter: "income",
        period: "month",
        category: null,
      },
      drill: DRILL,
    });
    expect(next.filter).toBe("income");
    expect(next.period).toBe("month");
  });
});
