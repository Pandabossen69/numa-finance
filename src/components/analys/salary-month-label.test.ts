import { describe, expect, it } from "vitest";
import { projectPayCycle, type PlanItem } from "@/domain/finance";
import { loneManadLabelSv } from "./salary-month-label";

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

describe("loneManadLabelSv", () => {
  it("explains September on 6 October with the live cycle span", () => {
    const items = [
      income("Lön sep", "2026-09-25T12:00:00.000Z"),
      income("Lön okt", "2026-10-25T12:00:00.000Z"),
    ];
    const now = new Date("2026-10-06T03:00:00.000Z");
    const live = projectPayCycle(items, now, TZ);
    expect(live.fundingMonthKey).toBe("2026-09");
    expect(live.startLabelSv).toBeTruthy();
    expect(live.endLabelSv).toBeTruthy();

    const label = loneManadLabelSv({
      monthKey: "2026-09",
      planItems: items,
      timeZone: TZ,
      now,
    });
    expect(label).toBe(`Lönemånad september · ${live.startLabelSv} – ${live.endLabelSv}`);
    expect(label?.toLowerCase()).toContain("sep");
    expect(label?.toLowerCase()).toContain("okt");
  });

  it("uses the browsed month's own window when it is not the open salary month", () => {
    const items = [
      income("Lön aug", "2026-08-25T12:00:00.000Z"),
      income("Lön sep", "2026-09-25T12:00:00.000Z"),
      income("Lön okt", "2026-10-25T12:00:00.000Z"),
    ];
    const now = new Date("2026-10-06T03:00:00.000Z");
    const label = loneManadLabelSv({
      monthKey: "2026-08",
      planItems: items,
      timeZone: TZ,
      now,
    });
    const live = projectPayCycle(items, now, TZ);
    expect(live.fundingMonthKey).toBe("2026-09");
    expect(label?.startsWith("Lönemånad augusti · ")).toBe(true);
    expect(label?.toLowerCase()).toContain("aug");
    expect(label?.startsWith("Lönemånad september")).toBe(false);
  });

  it("follows the shorter live window before the month's last income", () => {
    const items = [
      income("Tidig", "2026-09-03T12:00:00.000Z"),
      income("Lön sep", "2026-09-25T12:00:00.000Z"),
      income("Lön okt", "2026-10-25T12:00:00.000Z"),
    ];
    const now = new Date("2026-09-10T03:00:00.000Z");
    const live = projectPayCycle(items, now, TZ);
    expect(live.phase).toBe("partial");
    expect(live.fundingMonthKey).toBe("2026-09");
    expect(
      loneManadLabelSv({
        monthKey: "2026-09",
        planItems: items,
        timeZone: TZ,
        now,
      }),
    ).toBe(`Lönemånad september · ${live.startLabelSv} – ${live.endLabelSv}`);
  });

  it("stays quiet when the plan has no paycheck", () => {
    expect(
      loneManadLabelSv({
        monthKey: "2026-09",
        planItems: [],
        timeZone: TZ,
        now: new Date("2026-10-06T03:00:00.000Z"),
      }),
    ).toBeNull();
  });
});
