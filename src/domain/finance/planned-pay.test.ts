import { describe, expect, it } from "vitest";
import {
  isMissingPlannedPayColumn,
  payLaterDateBounds,
  plannedPayChipLabel,
  reservePayInstant,
} from "./planned-pay";

const tz = "Asia/Bangkok";

describe("payLaterDateBounds", () => {
  it("defaults to today + 3 and caps at the end of next month", () => {
    const bounds = payLaterDateBounds(new Date("2026-10-05T03:00:00.000Z"), tz);
    expect(bounds.min).toBe("2026-10-05");
    expect(bounds.defaultYmd).toBe("2026-10-08");
    expect(bounds.max).toBe("2026-11-30");
  });

  it("uses the Bangkok day when UTC is still the previous date", () => {
    const bounds = payLaterDateBounds(new Date("2026-10-04T20:00:00.000Z"), tz);
    expect(bounds.min).toBe("2026-10-05");
    expect(bounds.defaultYmd).toBe("2026-10-08");
  });
});

describe("plannedPayChipLabel", () => {
  const now = new Date("2026-10-05T03:00:00.000Z");

  it("names the planned day", () => {
    expect(
      plannedPayChipLabel(
        { plannedPayAt: "2026-10-08T12:00:00.000Z" },
        now,
        tz,
      ),
    ).toBe("Sen · betalas 8 okt");
  });

  it("says Sen when the planned day has passed", () => {
    expect(
      plannedPayChipLabel(
        { plannedPayAt: "2026-10-01T12:00:00.000Z" },
        now,
        tz,
      ),
    ).toBe("Sen");
  });
});

describe("reservePayInstant", () => {
  const now = new Date("2026-10-05T08:00:00.000Z");

  it("drops an overdue due date without a planned date", () => {
    expect(
      reservePayInstant("2026-09-30T12:00:00.000Z", null, now, tz),
    ).toBeNull();
  });

  it("keeps a planned date inside the window", () => {
    expect(
      reservePayInstant(
        "2026-09-30T12:00:00.000Z",
        "2026-10-08T12:00:00.000Z",
        now,
        tz,
      ),
    ).toBe(Date.parse("2026-10-08T12:00:00.000Z"));
  });

  it("counts a past planned date as today", () => {
    const today = reservePayInstant(
      "2026-09-30T12:00:00.000Z",
      "2026-10-01T12:00:00.000Z",
      now,
      tz,
    );
    expect(today).toBe(Date.parse("2026-10-05T12:00:00.000Z"));
  });
});

describe("isMissingPlannedPayColumn", () => {
  it("recognises a preview database that has not been migrated", () => {
    expect(
      isMissingPlannedPayColumn({
        code: "PGRST204",
        message:
          "Could not find the 'planned_pay_at' column of 'plan_items' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingPlannedPayColumn({
        code: "42703",
        message: 'column "planned_pay_at" of relation "plan_items" does not exist',
      }),
    ).toBe(true);
    expect(
      isMissingPlannedPayColumn({
        code: "23505",
        message: "duplicate key",
      }),
    ).toBe(false);
  });
});
