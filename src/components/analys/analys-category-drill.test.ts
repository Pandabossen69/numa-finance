import { beforeEach, describe, expect, it } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import {
  clearClientSessionCaches,
  lastMovementsView,
  rememberMovementsView,
  subscribeMovementsView,
} from "@/features/home/last-snapshot";
import {
  movementsViewForCategoryDrill,
  ovrigtDominatesSpend,
} from "./analys-category-drill";

describe("movementsViewForCategoryDrill", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("keeps Alla and Denna månad when the browsed month is current", () => {
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "month",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "all", period: "month", category: null },
      }),
    ).toEqual({ filter: "all", period: "month", category: "Mat" });
  });

  it("keeps an Utgifter chip and All tid on the current month", () => {
    expect(
      movementsViewForCategoryDrill(UNCATEGORISED_SPEND_NAME, {
        scope: "month",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "expense", period: "all", category: "Mat" },
      }),
    ).toEqual({
      filter: "expense",
      period: "all",
      category: UNCATEGORISED_SPEND_NAME,
    });
  });

  it("falls back to Alla when the type chip would hide spend", () => {
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "month",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "income", period: "month" },
      }).filter,
    ).toBe("all");
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "month",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "other", period: "month" },
      }).filter,
    ).toBe("all");
  });

  it("uses All tid for the pay cycle and for any other calendar month", () => {
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "period",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "expense", period: "month" },
      }),
    ).toEqual({ filter: "expense", period: "all", category: "Mat" });
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "month",
        activeMonthKey: "2026-08",
        currentMonthKey: "2026-09",
        existing: null,
      }),
    ).toEqual({ filter: "all", period: "all", category: "Mat" });
  });

  it("defaults a fresh Rörelser view to Alla and Denna månad", () => {
    expect(
      movementsViewForCategoryDrill("Mat", {
        scope: "month",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: null,
      }),
    ).toEqual({ filter: "all", period: "month", category: "Mat" });
  });

  it("notifies a mounted subscriber once, then ignores the same drill", () => {
    const seen: Array<string | null | undefined> = [];
    const stop = subscribeMovementsView(() => {
      seen.push(lastMovementsView()?.category);
    });
    const view = movementsViewForCategoryDrill(UNCATEGORISED_SPEND_NAME, {
      scope: "month",
      activeMonthKey: "2026-09",
      currentMonthKey: "2026-09",
      existing: lastMovementsView(),
    });
    rememberMovementsView(view);
    rememberMovementsView({ ...view });
    expect(lastMovementsView()).toEqual({
      filter: "all",
      period: "month",
      category: "Övrigt",
    });
    expect(seen).toEqual(["Övrigt"]);
    stop();
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
