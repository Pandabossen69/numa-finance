import { describe, expect, it } from "vitest";
import {
  isSameZonedDay,
  occurredAtForRelativeDay,
} from "./datetime";

describe("occurredAtForRelativeDay", () => {
  it("maps yesterday to the previous Bangkok calendar day, not UTC-24h", () => {
    // 01:30 UTC on Aug 10 = 08:30 Bangkok — still Aug 10 locally.
    // UTC-24h would land on Aug 9 01:30 UTC = Aug 9 08:30 Bangkok (ok),
    // but near midnight Bangkok the naive UTC-24h drifts to the wrong day.
    const now = new Date("2026-08-10T17:30:00.000Z"); // Aug 11 00:30 Bangkok
    const yesterday = occurredAtForRelativeDay(
      "yesterday",
      "Asia/Bangkok",
      now,
    );
    expect(isSameZonedDay(yesterday, "2026-08-10T12:00:00+07:00", "Asia/Bangkok")).toBe(
      true,
    );
    expect(isSameZonedDay(yesterday, now, "Asia/Bangkok")).toBe(false);
  });

  it("keeps today on the current Bangkok calendar day", () => {
    const now = new Date("2026-08-10T17:30:00.000Z"); // Aug 11 Bangkok
    const today = occurredAtForRelativeDay("today", "Asia/Bangkok", now);
    expect(isSameZonedDay(today, now, "Asia/Bangkok")).toBe(true);
  });
});
