import { describe, expect, it } from "vitest";
import { occurredOnForConfirm, suggestedCaptureDate } from "./capture-review";

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
