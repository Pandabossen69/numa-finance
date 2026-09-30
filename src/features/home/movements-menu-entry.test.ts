import { beforeEach, describe, expect, it } from "vitest";
import { UNCATEGORISED_SPEND_NAME } from "@/domain/finance";
import { movementsViewForCategoryDrill } from "@/components/analys/analys-category-drill";
import {
  clearClientSessionCaches,
  lastMovementsView,
  rememberMovementsView,
  resetMovementsViewForMenuEntry,
  subscribeMovementsView,
  movementsViewForMenuEntry,
} from "./last-snapshot";

const CYCLE_START = "2026-09-03T00:00:00.000Z";
const CYCLE_END = "2026-10-25T00:00:00.000Z";

describe("movementsViewForMenuEntry", () => {
  beforeEach(() => {
    clearClientSessionCaches();
  });

  it("resets filter, period and category and keeps pay-cycle bounds", () => {
    expect(
      movementsViewForMenuEntry({
        filter: "expense",
        period: "cycle",
        category: "Mat",
        cycleStartAt: CYCLE_START,
        cycleEndAt: CYCLE_END,
      }),
    ).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "menu",
    });
  });

  it("uses null bounds when Rörelser has not seen a period yet", () => {
    expect(movementsViewForMenuEntry(null)).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: null,
      cycleEndAt: null,
      source: "menu",
    });
    expect(
      movementsViewForMenuEntry({
        filter: "income",
        period: "month",
        category: "Lön",
      }),
    ).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: null,
      cycleEndAt: null,
      source: "menu",
    });
  });

  it("commits the menu default once and ignores the same reset", () => {
    const seen: Array<string> = [];
    const stop = subscribeMovementsView(() => {
      const view = lastMovementsView();
      seen.push(
        `${view?.filter}:${view?.period}:${view?.category ?? ""}:${view?.cycleEndAt ?? ""}`,
      );
    });
    rememberMovementsView({
      filter: "expense",
      period: "cycle",
      category: UNCATEGORISED_SPEND_NAME,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "drill",
    });
    const next = resetMovementsViewForMenuEntry();
    resetMovementsViewForMenuEntry();
    expect(next).toEqual({
      filter: "all",
      period: "all",
      category: null,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "menu",
    });
    expect(lastMovementsView()).toEqual(next);
    expect(seen).toEqual([
      `expense:cycle:${UNCATEGORISED_SPEND_NAME}:${CYCLE_END}`,
      `all:all::${CYCLE_END}`,
    ]);
    stop();
  });

  it("keeps the Perioden category drill on Utgifter after a menu reset", () => {
    rememberMovementsView(
      movementsViewForCategoryDrill("Mat", {
        scope: "period",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: { filter: "all", period: "month" },
        cycleStartAt: CYCLE_START,
        cycleEndAt: CYCLE_END,
      }),
    );
    resetMovementsViewForMenuEntry();
    expect(
      movementsViewForCategoryDrill(UNCATEGORISED_SPEND_NAME, {
        scope: "period",
        activeMonthKey: "2026-09",
        currentMonthKey: "2026-09",
        existing: lastMovementsView(),
        cycleStartAt: CYCLE_START,
        cycleEndAt: CYCLE_END,
      }),
    ).toEqual({
      filter: "expense",
      period: "cycle",
      category: UNCATEGORISED_SPEND_NAME,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "drill",
    });
  });

  it("keeps Utgifter when nothing was drilled", () => {
    const chosen = {
      filter: "expense" as const,
      period: "all" as const,
      category: null,
    };
    rememberMovementsView(chosen);
    expect(resetMovementsViewForMenuEntry()).toEqual(chosen);
    expect(lastMovementsView()).toEqual(chosen);
  });

  it("keeps a Utgifter filter the user chose", () => {
    const chosen = {
      filter: "expense" as const,
      period: "month" as const,
      category: null,
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
      source: "user" as const,
    };
    rememberMovementsView(chosen);
    expect(resetMovementsViewForMenuEntry()).toEqual(chosen);
    expect(lastMovementsView()).toEqual(chosen);
  });
});
