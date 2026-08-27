import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  earliestInstant,
  formatCountSv,
  formatDaysUntilSv,
  formatIsoDateOnlySv,
  formatListDateSv,
  isCalendarDate,
  isoToDateInput,
  nextCommittedCalendarDate,
  formatRelativeVerificationSv,
  isSameZonedDay,
  snapshotLedgerWindow,
  startOfZonedDay,
  zonedDayAnchorMs,
  zonedDayKey,
} from "./datetime";
import { monthKeyFromDate, spendDaysForMonth } from "./plan-months";

const tz = "Asia/Bangkok";

describe("zoned calendar helpers (Asia/Bangkok)", () => {
  it("zonedDayKey uses local calendar day, not UTC ISO slice", () => {
    // 10:00 Bangkok = 03:00 UTC — UTC slice of local midnight would be Aug 10.
    const midMorning = new Date("2026-08-11T03:00:00.000Z");
    expect(zonedDayKey(midMorning, tz)).toBe("2026-08-11");
    expect(
      startOfZonedDay(midMorning, tz).toISOString().slice(0, 10),
    ).toBe("2026-08-10");

    // Just after Bangkok midnight.
    const afterMidnight = new Date("2026-08-10T17:30:00.000Z");
    expect(zonedDayKey(afterMidnight, tz)).toBe("2026-08-11");
  });

  it("monthKeyFromDate flips at Bangkok midnight, not UTC", () => {
    // 00:30 Bangkok Sep 1 = Aug 31 17:30 UTC
    const bangkokSep1 = new Date("2026-08-31T17:30:00.000Z");
    expect(monthKeyFromDate(bangkokSep1, tz)).toBe("2026-09");
    expect(monthKeyFromDate(bangkokSep1, "UTC")).toBe("2026-08");

    // Still August in Bangkok (23:30 Aug 31).
    const bangkokAug31 = new Date("2026-08-31T16:30:00.000Z");
    expect(monthKeyFromDate(bangkokAug31, tz)).toBe("2026-08");
  });

  it("isSameZonedDay matches across the UTC date line for Bangkok", () => {
    const now = new Date("2026-08-11T03:00:00.000Z");
    // Previous UTC calendar day, same Bangkok day.
    expect(isSameZonedDay("2026-08-10T20:00:00.000Z", now, tz)).toBe(true);
    // Previous Bangkok day.
    expect(isSameZonedDay("2026-08-10T16:00:00.000Z", now, tz)).toBe(false);
  });

  it("spendDaysForMonth uses Bangkok day-of-month", () => {
    // 00:30 Bangkok Aug 12 → 20 days left in August (12..31).
    const early = new Date("2026-08-11T17:30:00.000Z");
    expect(spendDaysForMonth("2026-08", early, tz)).toBe(20);
  });

  it("calendar day anchors stay noon-UTC for stable day counts", () => {
    expect(zonedDayAnchorMs(new Date("2026-08-11T03:00:00.000Z"), tz)).toBe(
      Date.parse("2026-08-11T12:00:00.000Z"),
    );
    expect(
      calendarDaysBetween(
        new Date("2026-08-11T03:00:00.000Z"),
        "2026-08-23T12:00:00.000Z",
        tz,
      ),
    ).toBe(12);
  });
});

describe("Swedish relative verification copy", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("uses singular timme / dag / minut", () => {
    expect(
      formatRelativeVerificationSv("2026-08-11T11:00:00.000Z", now),
    ).toBe("1 timme sedan");
    expect(
      formatRelativeVerificationSv("2026-08-10T12:00:00.000Z", now),
    ).toBe("1 dag sedan");
    expect(
      formatRelativeVerificationSv("2026-08-11T11:30:00.000Z", now),
    ).toBe("30 minuter sedan");
    expect(
      formatRelativeVerificationSv("2026-08-11T11:59:00.000Z", now),
    ).toBe("1 minut sedan");
  });

  it("keeps plural forms for counts ≠ 1", () => {
    expect(
      formatRelativeVerificationSv("2026-08-11T09:00:00.000Z", now),
    ).toBe("3 timmar sedan");
    expect(
      formatRelativeVerificationSv("2026-08-09T12:00:00.000Z", now),
    ).toBe("2 dagar sedan");
    expect(formatCountSv(1, "dag", "dagar")).toBe("1 dag");
    expect(formatCountSv(12, "dag", "dagar")).toBe("12 dagar");
  });

  it("counts verification days on Bangkok civil days, not raw UTC hours/24", () => {
    // 27 Aug 10:00 Bangkok; last saldo 23 Aug 22:00 Bangkok = 4 civil days.
    const now = new Date("2026-08-27T03:00:00.000Z");
    expect(
      formatRelativeVerificationSv("2026-08-23T15:00:00.000Z", now, tz),
    ).toBe("4 dagar sedan");
    expect(
      formatRelativeVerificationSv("2026-08-27T02:00:00.000Z", now, tz),
    ).toBe("1 timme sedan");
  });
});

describe("formatDaysUntilSv", () => {
  it("says idag when the horizon is today, and kvar otherwise", () => {
    expect(formatDaysUntilSv(0)).toBe("idag");
    expect(formatDaysUntilSv(-3)).toBe("idag");
    expect(formatDaysUntilSv(1)).toBe("1 dag kvar");
    expect(formatDaysUntilSv(4)).toBe("4 dagar kvar");
  });
});

describe("snapshot ledger window", () => {
  const monthStart = new Date("2026-08-01T00:00:00.000+07:00");

  it("picks the earlier of month vs cycle start via Date, not ISO string sort", () => {
    const offsetCycle = "2026-07-25T17:00:00.000Z";
    const plusOffset = "2026-07-26T00:00:00+07:00";
    expect(earliestInstant(offsetCycle, plusOffset)?.toISOString()).toBe(
      "2026-07-25T17:00:00.000Z",
    );
    const window = snapshotLedgerWindow({
      monthStart,
      cycleStartAt: plusOffset,
    });
    expect(window.spendSinceIso).toBe("2026-07-25T17:00:00.000Z");
    expect(window.refetchFromCheckpoint).toBe(false);
  });

  it("refetches from checkpoint when it is older than the spend window", () => {
    const window = snapshotLedgerWindow({
      monthStart,
      cycleStartAt: "2026-08-10T00:00:00.000+07:00",
      checkpointVerifiedAt: "2026-07-20T09:15:00.000Z",
    });
    expect(window.spendSinceIso).toBe(monthStart.toISOString());
    expect(window.refetchFromCheckpoint).toBe(true);
    expect(window.saldoSinceIso).toBe("2026-07-20T09:15:00.000Z");
  });

  it("keeps the spend window when checkpoint is newer (saldo filters extra txs)", () => {
    const window = snapshotLedgerWindow({
      monthStart,
      checkpointVerifiedAt: "2026-08-12T04:00:00.000Z",
    });
    expect(window.refetchFromCheckpoint).toBe(false);
    expect(window.saldoSinceIso).toBe(window.spendSinceIso);
  });

  it("extends the spend window back to plan history for extra saldo", () => {
    const window = snapshotLedgerWindow({
      monthStart: new Date("2026-10-01T00:00:00.000+07:00"),
      cycleStartAt: "2026-09-23T00:00:00.000+07:00",
      historySince: new Date("2026-08-01T00:00:00.000+07:00"),
    });
    expect(window.spendSinceIso).toBe("2026-07-31T17:00:00.000Z");
    expect(window.refetchFromCheckpoint).toBe(false);
  });
});

describe("formatListDateSv", () => {
  it("uses Swedish month names, not US M/D/YYYY", () => {
    const label = formatListDateSv("2026-08-23T15:00:00.000Z", "Asia/Bangkok");
    expect(label.toLowerCase()).toMatch(/aug/);
    expect(label).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(label).toMatch(/23/);
  });
});

describe("formatIsoDateOnlySv", () => {
  it("formats a calendar date as Swedish short month", () => {
    expect(formatIsoDateOnlySv("2026-08-28").toLowerCase()).toMatch(/28/);
    expect(formatIsoDateOnlySv("2026-08-28").toLowerCase()).toMatch(/aug/);
    expect(formatIsoDateOnlySv("2026-08-28")).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe("isoToDateInput (Asia/Bangkok)", () => {
  it("keeps a date-only value as the calendar day", () => {
    expect(isoToDateInput("2026-08-27", tz)).toBe("2026-08-27");
    expect(isCalendarDate("2026-08-27")).toBe(true);
    expect(isCalendarDate("")).toBe(false);
  });

  it("uses the Bangkok civil day, not the UTC ISO slice", () => {
    // 00:30 Bangkok Aug 27 = Aug 26 17:30 UTC
    expect(isoToDateInput("2026-08-26T17:30:00.000Z", tz)).toBe("2026-08-27");
    expect("2026-08-26T17:30:00.000Z".slice(0, 10)).toBe("2026-08-26");
  });

  it("keeps noon-UTC anchors on the same Bangkok day", () => {
    expect(isoToDateInput("2026-08-27T12:00:00.000Z", tz)).toBe("2026-08-27");
  });

  it("commits a new calendar date and ignores empty or unchanged values", () => {
    expect(nextCommittedCalendarDate("2026-08-10", "2026-08-25")).toBe(
      "2026-08-10",
    );
    expect(nextCommittedCalendarDate("2026-08-25", "2026-08-25")).toBe(null);
    expect(nextCommittedCalendarDate("", "2026-08-25")).toBe(null);
    expect(nextCommittedCalendarDate("2026-08", "2026-08-25")).toBe(null);
  });
});
