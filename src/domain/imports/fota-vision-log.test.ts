import { describe, expect, it, vi } from "vitest";
import { fotaVisionDropReport, warnFotaVisionDrop } from "./fota-vision-log";

describe("fota vision drop log", () => {
  it("records which fields were null and nothing else", () => {
    const report = fotaVisionDropReport({
      model: "gpt-4o",
      mode: "bank_app",
      detectedKind: "bank_app_list",
      rows: [
        { amountMajor: null, currency: "SEK", occurredAt: "23 jul. 2026 16:46" },
        { amountMajor: 89.5, currency: null, occurredAt: null },
      ],
    });
    expect(report).toEqual({
      model: "gpt-4o",
      mode: "bank_app",
      detectedKind: "bank_app_list",
      rowCount: 2,
      rows: [
        { amountNull: true, currencyNull: false, occurredAtNull: false },
        { amountNull: false, currencyNull: true, occurredAtNull: true },
      ],
    });
    expect(JSON.stringify(report)).not.toMatch(/89\.5|jul|ICA|SEK/);
  });

  it("emits one [fota-vision] warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnFotaVisionDrop({
      model: "gpt-4o",
      mode: "bank_app",
      detectedKind: "bank_app_detail",
      rows: [{ amountMajor: 1, currency: null, occurredAt: null }],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe("[fota-vision]");
    warn.mockRestore();
  });
});
