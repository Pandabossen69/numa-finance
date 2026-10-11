import { beforeEach, describe, expect, it } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import {
  clearClientSessionCaches,
  lastMovementsView,
  rememberMovementsView,
} from "@/features/home/last-snapshot";
import {
  categoryDrillHref,
  movementsDrillForCategory,
  ovrigtDominatesSpend,
} from "./analys-category-drill";
import { drillSummaryFromRows } from "@/components/movements/drill-summary";
import {
  drillMonthChipLabel,
  lastMovementsDrill,
  movementsDrillFromHref,
  rememberMovementsDrillFromHref,
  resetMovementsDrillForTests,
} from "@/components/movements/movements-drill";
import { movementVisibleInRorelser } from "@/components/movements/movements-window";

const CYCLE_START = "2026-09-03T00:00:00.000Z";
const CYCLE_END = "2026-10-25T00:00:00.000Z";

describe("movementsDrillForCategory", () => {
  beforeEach(() => {
    clearClientSessionCaches();
    resetMovementsDrillForTests();
  });

  it("maps Månad to Denna månad + Utgifter even when the saved view is All tid / Alla", () => {
    // Prod 7dd0576 and both XA previews: September → Övrigt opened All tid
    // because the old mapper copied existing.period when it was "all".
    rememberMovementsView({
      filter: "all",
      period: "all",
      category: null,
    });
    const drill = movementsDrillForCategory(UNCATEGORISED_SPEND_NAME, {
      scope: "month",
    });
    expect(drill).toEqual({
      period: "month",
      filter: "expense",
      category: UNCATEGORISED_SPEND_NAME,
      from: null,
      to: null,
    });
    expect(lastMovementsView()).toEqual({
      filter: "all",
      period: "all",
      category: null,
    });
    const href = categoryDrillHref(UNCATEGORISED_SPEND_NAME, { scope: "month" });
    expect(href).toContain("drill=1");
    expect(href).toContain("period=month");
    expect(href).toContain("filter=expense");
    expect(movementsDrillFromHref(href)).toEqual(drill);
  });

  it("pins Månad to the browsed month and does not save that chip", () => {
    rememberMovementsView({
      filter: "all",
      period: "all",
      category: null,
    });
    const drill = movementsDrillForCategory(UNCATEGORISED_SPEND_NAME, {
      scope: "month",
      monthKey: "2026-09",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(drill).toEqual({
      period: "month",
      filter: "expense",
      category: UNCATEGORISED_SPEND_NAME,
      from: null,
      to: null,
      monthKey: "2026-09",
    });
    expect(drillMonthChipLabel(drill.monthKey)).toBe("September");
    const href = categoryDrillHref(UNCATEGORISED_SPEND_NAME, {
      scope: "month",
      monthKey: "2026-09",
    });
    expect(href).toContain("month=2026-09");
    expect(href).not.toContain("period=cycle");
    expect(movementsDrillFromHref(href)).toEqual(drill);
    rememberMovementsDrillFromHref(href);
    expect(lastMovementsDrill()?.monthKey).toBe("2026-09");
    expect(lastMovementsView()).toEqual({
      filter: "all",
      period: "all",
      category: null,
    });
  });

  it("keeps the nine September Övrigt rows when today is in October", () => {
    const drill = movementsDrillForCategory(UNCATEGORISED_SPEND_NAME, {
      scope: "month",
      monthKey: "2026-09",
    });
    const september = Array.from({ length: 9 }, (_, index) => ({
      transactionType: "expense" as const,
      direction: "debit" as const,
      category: null as string | null,
      amountMinor: 100_00,
      occurredAt: `2026-09-${String(index + 1).padStart(2, "0")}T04:00:00.000Z`,
    }));
    const october = {
      transactionType: "expense" as const,
      direction: "debit" as const,
      category: null as string | null,
      amountMinor: 50_00,
      occurredAt: "2026-10-12T04:00:00.000Z",
    };
    const browsed = {
      filter: drill.filter,
      period: drill.period,
      category: drill.category,
      monthKey: drill.monthKey ?? "2026-10",
      timeZone: "Asia/Bangkok",
    };
    const visible = [...september, october].filter((tx) =>
      movementVisibleInRorelser(tx, browsed),
    );
    expect(visible).toHaveLength(9);
    const calendarMonth = { ...browsed, monthKey: "2026-10" };
    expect(
      september.filter((tx) => movementVisibleInRorelser(tx, calendarMonth)),
    ).toHaveLength(0);
    const summary = drillSummaryFromRows(visible, {
      category: UNCATEGORISED_SPEND_NAME,
      period: "month",
      filter: "expense",
    });
    expect(summary).toMatchObject({
      label: "Övrigt i månaden",
      count: 9,
      amountMinor: 900_00,
    });
  });

  it("maps Perioden to the pay-cycle window + Utgifter + category", () => {
    const drill = movementsDrillForCategory("Mat", {
      scope: "period",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(drill).toEqual({
      period: "cycle",
      filter: "expense",
      category: "Mat",
      from: CYCLE_START,
      to: CYCLE_END,
    });
    expect(movementsDrillFromHref(categoryDrillHref("Mat", {
      scope: "period",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      monthKey: "2026-09",
    }))).toEqual(drill);
    const href = categoryDrillHref("Mat", {
      scope: "period",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      monthKey: "2026-09",
    });
    expect(href).not.toContain("month=");
    expect(movementsDrillFromHref(href)?.monthKey ?? null).toBeNull();
  });

  it("keeps a drill in the session store and drops it when the href has no params", () => {
    const href = categoryDrillHref(UNCATEGORISED_SPEND_NAME, { scope: "month" });
    rememberMovementsDrillFromHref(href);
    expect(lastMovementsDrill()?.period).toBe("month");
    expect(lastMovementsDrill()?.category).toBe(UNCATEGORISED_SPEND_NAME);
    rememberMovementsDrillFromHref("/transaktioner");
    expect(lastMovementsDrill()).toBeNull();
    expect(lastMovementsView()).toBeNull();
  });
});

describe("ovrigtDominatesSpend", () => {
  it("is true when Övrigt is the top row and at least half of Spenderat", () => {
    // Screenshot: 25 191 / 27 679 ≈ 91%.
    expect(
      ovrigtDominatesSpend([
        { name: "Övrigt", amountMinor: 2_519_100 },
        { name: "Mat", amountMinor: 248_800 },
      ]),
    ).toBe(true);
    expect(
      ovrigtDominatesSpend([
        { name: "Övrigt", amountMinor: 50 },
        { name: "Mat", amountMinor: 50 },
      ]),
    ).toBe(true);
  });

  it("stays quiet when Övrigt is under half or is not the top row", () => {
    expect(
      ovrigtDominatesSpend([
        { name: "Övrigt", amountMinor: 49 },
        { name: "Mat", amountMinor: 51 },
      ]),
    ).toBe(false);
    expect(
      ovrigtDominatesSpend([
        { name: "Mat", amountMinor: 90 },
        { name: "Övrigt", amountMinor: 10 },
      ]),
    ).toBe(false);
    expect(ovrigtDominatesSpend([])).toBe(false);
    expect(ovrigtDominatesSpend([{ name: "Övrigt", amountMinor: 0 }])).toBe(false);
  });
});
