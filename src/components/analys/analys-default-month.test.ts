import { describe, expect, it } from "vitest";
import type { PlanItem } from "@/domain/finance";
import {
  analysActiveMonthKey,
  defaultAnalysMonthKey,
  sharedMonthIsPicked,
} from "./analys-default-month";

function income(name: string, nextDueAt: string): PlanItem {
  return {
    id: name,
    userId: "u1",
    name,
    kind: "expected",
    amountMinor: 40_000_00,
    currency: "THB",
    cadence: "income",
    nextDueAt,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const TZ = "Asia/Bangkok";
const NOW = new Date("2026-10-12T03:00:00.000Z");
const ITEMS = [
  income("Tidig", "2026-09-03T12:00:00.000Z"),
  income("Lön sep", "2026-09-25T12:00:00.000Z"),
];

describe("defaultAnalysMonthKey", () => {
  it("opens Månad on the civil month even when the pay cycle started earlier", () => {
    expect(
      defaultAnalysMonthKey({
        planItems: ITEMS,
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-10");
  });

  it("keeps the calendar month when there is no pay cycle", () => {
    expect(
      defaultAnalysMonthKey({
        planItems: [],
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-10");
    expect(
      defaultAnalysMonthKey({
        planItems: [
          {
            ...income("Hyra", "2026-10-01T12:00:00.000Z"),
            cadence: "monthly",
            kind: "mandatory",
          },
        ],
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-10");
  });

  it("follows a month the user already chose, including calendar October", () => {
    expect(
      analysActiveMonthKey({
        shared: { monthKey: "2026-10", viewYear: 2026, picked: true },
        planItems: ITEMS,
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-10");
    expect(
      analysActiveMonthKey({
        shared: { monthKey: "2026-08", viewYear: 2026 },
        planItems: ITEMS,
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-08");
  });

  it("ignores a saved civil month that Plan used to publish on mount", () => {
    expect(sharedMonthIsPicked({ monthKey: "2026-10", viewYear: 2026 }, "2026-10")).toBe(
      false,
    );
    expect(
      analysActiveMonthKey({
        shared: { monthKey: "2026-10", viewYear: 2026 },
        planItems: ITEMS,
        currentMonthKey: "2026-10",
        timeZone: TZ,
        now: NOW,
      }),
    ).toBe("2026-10");
  });
});
