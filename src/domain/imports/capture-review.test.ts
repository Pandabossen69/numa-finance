import { describe, expect, it } from "vitest";
import { zonedDayKey } from "@/domain/finance/datetime";
import {
  confirmOccurredAt,
  occurredOnForConfirm,
  suggestedCaptureDate,
} from "./capture-review";

const tz = "Asia/Bangkok";
/** 2026-09-28 02:00 ICT. */
const now = new Date("2026-09-27T19:00:00.000Z");
const fallbackIso = "2026-09-27T18:00:00.000Z";

describe("suggestedCaptureDate", () => {
  it("uses the newest stamp and falls back to today", () => {
    expect(
      suggestedCaptureDate(
        ["2026-09-20T10:00:00.000Z", "2026-09-24T02:30:00.000Z"],
        new Date("2026-09-25T00:00:00.000Z"),
        "Asia/Bangkok",
      ),
    ).toBe("2026-09-24");
    expect(
      suggestedCaptureDate(
        [null],
        new Date("2026-09-25T00:00:00.000Z"),
        "Asia/Bangkok",
      ),
    ).toBe("2026-09-25");
  });
});

describe("occurredOnForConfirm", () => {
  it("sends the date for a receipt and a single row", () => {
    expect(
      occurredOnForConfirm({
        isAutoImport: false,
        eventCount: 0,
        suggestedOn: "2026-09-25",
        editedOn: "2026-09-25",
      }),
    ).toBe("2026-09-25");
    expect(
      occurredOnForConfirm({
        isAutoImport: true,
        eventCount: 1,
        suggestedOn: "2026-09-24",
        editedOn: "2026-09-24",
      }),
    ).toBe("2026-09-24");
  });

  it("leaves a multi-row import on its own timestamps until the date is edited", () => {
    expect(
      occurredOnForConfirm({
        isAutoImport: true,
        eventCount: 3,
        suggestedOn: "2026-09-24",
        editedOn: "2026-09-24",
      }),
    ).toBeNull();
    expect(
      occurredOnForConfirm({
        isAutoImport: true,
        eventCount: 3,
        suggestedOn: "2026-09-24",
        editedOn: "2026-09-22",
      }),
    ).toBe("2026-09-22");
  });
});

describe("confirmOccurredAt", () => {
  it("uses now − 2s for a receipt confirmed today with no OCR time", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-28",
      candidateOccurredAt: null,
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(Date.parse(result)).toBe(now.getTime() - 2_000);
    expect(Date.parse(result)).toBeLessThanOrEqual(now.getTime());
    expect(zonedDayKey(result, tz)).toBe("2026-09-28");
  });

  it("keeps 12:00 local on an earlier chosen day with no OCR time", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-26",
      candidateOccurredAt: null,
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(result).toBe("2026-09-26T12:00:00+07:00");
    expect(Date.parse(result)).toBe(Date.parse("2026-09-26T05:00:00.000Z"));
  });

  it("clamps a future OCR time to now", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-28",
      candidateOccurredAt: "2026-09-28T14:30:00+07:00",
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(Date.parse(result)).toBe(now.getTime() - 2_000);
    expect(Date.parse(result)).toBeLessThanOrEqual(now.getTime());
    expect(zonedDayKey(result, tz)).toBe("2026-09-28");
  });

  it("uses a past OCR time exactly", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-28",
      candidateOccurredAt: "2026-09-28T01:15:00+07:00",
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(result).toBe("2026-09-28T01:15:00+07:00");
    expect(Date.parse(result)).toBe(Date.parse("2026-09-28T01:15:00+07:00"));
  });

  it("reads a UTC OCR stamp as Bangkok wall time, not the UTC clock", () => {
    for (const stamp of ["2026-09-27T18:15:00+00:00", "2026-09-27T18:15:00Z"]) {
      const result = confirmOccurredAt({
        occurredOn: "2026-09-28",
        candidateOccurredAt: stamp,
        fallbackIso,
        timeZone: tz,
        now,
      });
      expect(result).toBe("2026-09-28T01:15:00+07:00");
      expect(result).not.toContain("T18:15");
    }
  });

  it("clamps a future chosen day to now", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-29",
      candidateOccurredAt: null,
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(Date.parse(result)).toBeLessThanOrEqual(now.getTime());
    expect(Date.parse(result)).toBe(now.getTime() - 2_000);
    expect(zonedDayKey(result, tz)).toBe("2026-09-28");
  });

  it("keeps a batch fallback when no date was sent", () => {
    expect(
      confirmOccurredAt({
        occurredOn: null,
        candidateOccurredAt: "2026-09-28T14:30:00+07:00",
        fallbackIso,
        timeZone: tz,
        now,
      }),
    ).toBe(fallbackIso);
  });

  it("clamps a future batch fallback so occurred_at is never after now", () => {
    const future = "2026-09-28T12:00:00+07:00";
    const result = confirmOccurredAt({
      occurredOn: null,
      candidateOccurredAt: null,
      fallbackIso: future,
      timeZone: tz,
      now,
    });
    expect(result).not.toBe(future);
    expect(Date.parse(result)).toBe(now.getTime() - 2_000);
  });

  it("places the OCR wall clock on a different chosen day", () => {
    expect(
      confirmOccurredAt({
        occurredOn: "2026-09-26",
        candidateOccurredAt: "2026-09-27T18:15:00Z",
        fallbackIso,
        timeZone: tz,
        now,
      }),
    ).toBe("2026-09-26T01:15:00+07:00");
  });

  it("treats an unparseable OCR stamp as no time", () => {
    const result = confirmOccurredAt({
      occurredOn: "2026-09-28",
      candidateOccurredAt: "inte-en-tid",
      fallbackIso,
      timeZone: tz,
      now,
    });
    expect(Date.parse(result)).toBe(now.getTime() - 2_000);
    expect(zonedDayKey(result, tz)).toBe("2026-09-28");
  });
});
