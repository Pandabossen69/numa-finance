import { describe, expect, it } from "vitest";
import {
  OCR_MAX_PER_HOUR,
  OCR_RATE_LIMIT_SV,
  isOcrOverLimit,
  ocrWindowStartIso,
} from "./ocr-rate-limit";

describe("ocr rate limit", () => {
  it("allows 19 reads and blocks the 20th in the hour", () => {
    expect(isOcrOverLimit(0)).toBe(false);
    expect(isOcrOverLimit(OCR_MAX_PER_HOUR - 1)).toBe(false);
    expect(isOcrOverLimit(OCR_MAX_PER_HOUR)).toBe(true);
    expect(isOcrOverLimit(OCR_MAX_PER_HOUR + 3)).toBe(true);
  });

  it("windows the last hour from now", () => {
    const now = Date.parse("2026-08-28T13:00:00.000Z");
    expect(ocrWindowStartIso(now)).toBe("2026-08-28T12:00:00.000Z");
  });

  it("speaks Swedish when the cap hits", () => {
    expect(OCR_RATE_LIMIT_SV).toMatch(/foton/i);
    expect(OCR_RATE_LIMIT_SV).not.toMatch(/rate|limit|openai/i);
  });
});
