import { describe, expect, it } from "vitest";
import { expenseHomeDeltas } from "./expense-date-delta";

describe("expenseHomeDeltas", () => {
  it("moves a today expense off Kvar idag without changing the balance", () => {
    expect(
      expenseHomeDeltas({
        prevMinor: 100,
        nextMinor: 100,
        prevToday: true,
        nextToday: false,
      }),
    ).toEqual({ todayDelta: -100, balanceIncomeDelta: -100 });
  });

  it("keeps a past-day amount change off Kvar idag", () => {
    expect(
      expenseHomeDeltas({
        prevMinor: 100,
        nextMinor: 150,
        prevToday: false,
        nextToday: false,
      }),
    ).toEqual({ todayDelta: 0, balanceIncomeDelta: -50 });
  });
});
