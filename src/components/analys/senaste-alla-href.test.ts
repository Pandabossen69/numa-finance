import { beforeEach, describe, expect, it } from "vitest";
import {
  clearClientSessionCaches,
  lastMovementsView,
  rememberMovementsView,
} from "@/features/home/last-snapshot";
import {
  lastMovementsDrill,
  movementsDrillFromHref,
  rememberMovementsDrillFromHref,
  resetMovementsDrillForTests,
  senasteAllaHref,
} from "@/components/movements/movements-drill";

const CYCLE_START = "2026-09-03T00:00:00.000Z";
const CYCLE_END = "2026-10-25T00:00:00.000Z";

describe("senasteAllaHref", () => {
  beforeEach(() => {
    clearClientSessionCaches();
    resetMovementsDrillForTests();
  });

  it("opens Rörelser on the live pay period without saving that view", () => {
    rememberMovementsView({
      filter: "expense",
      period: "month",
      category: "Mat",
    });
    const href = senasteAllaHref({
      scope: "period",
      monthKey: "2026-10",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(href).toContain("drill=1");
    expect(href).toContain("period=cycle");
    expect(href).toContain("filter=all");
    expect(href).toContain(`from=${encodeURIComponent(CYCLE_START)}`);
    expect(href).toContain(`to=${encodeURIComponent(CYCLE_END)}`);
    expect(href).not.toContain("cat=");
    expect(movementsDrillFromHref(href)).toEqual({
      period: "cycle",
      filter: "all",
      category: null,
      from: CYCLE_START,
      to: CYCLE_END,
    });
    rememberMovementsDrillFromHref(href);
    expect(lastMovementsDrill()?.period).toBe("cycle");
    expect(lastMovementsView()).toEqual({
      filter: "expense",
      period: "month",
      category: "Mat",
    });
  });

  it("opens the browsed calendar month when Senaste is on Månad", () => {
    const href = senasteAllaHref({
      scope: "month",
      monthKey: "2026-09",
      cycleStartAt: CYCLE_START,
      cycleEndAt: CYCLE_END,
    });
    expect(movementsDrillFromHref(href)).toEqual({
      period: "month",
      filter: "all",
      category: null,
      from: null,
      to: null,
      monthKey: "2026-09",
    });
    expect(href).not.toContain("period=cycle");
  });

  it("keeps Perioden empty when there is no pay-cycle window", () => {
    const href = senasteAllaHref({
      scope: "period",
      monthKey: "2026-10",
      cycleStartAt: null,
      cycleEndAt: null,
    });
    const drill = movementsDrillFromHref(href);
    expect(drill?.period).toBe("cycle");
    expect(drill?.from).toBeNull();
    expect(drill?.monthKey ?? null).toBeNull();
  });
});
