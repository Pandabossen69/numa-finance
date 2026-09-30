import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPLOAD_SAVE_FAILED_SV, uploadErrorMessageSv } from "./candidate-reuse";
import {
  UPLOAD_HOURLY_IMAGE_LIMIT,
  UPLOAD_RATE_LIMIT_CODE,
  UploadRateLimitError,
  hourlyUploadsThatCount,
  uploadLimitFlags,
  uploadRateLimitMessageSv,
  uploadRateLimitRetryAt,
} from "./upload-rate-limit";

const OLDEST = "2026-09-27T23:05:00.000Z";
const RETRY_AT = new Date("2026-09-28T00:05:00.000Z");
const BANGKOK_LOCKOUT =
  "Du har nått gränsen på 20 bilder per timme. Du kan fota igen kl. 07:05.";

describe("hourly image cap", () => {
  it("opens again one hour after the oldest observation in the window", () => {
    expect(UPLOAD_HOURLY_IMAGE_LIMIT).toBe(20);
    expect(uploadRateLimitRetryAt(OLDEST).toISOString()).toBe(
      RETRY_AT.toISOString(),
    );
    expect(uploadRateLimitRetryAt(new Date(OLDEST)).toISOString()).toBe(
      RETRY_AT.toISOString(),
    );
  });

  it("maps the typed lockout to the household clock and never says Försök igen", () => {
    const error = new UploadRateLimitError({
      retryAt: uploadRateLimitRetryAt(OLDEST),
      timeZone: "Asia/Bangkok",
    });
    expect(error.code).toBe(UPLOAD_RATE_LIMIT_CODE);
    expect(uploadErrorMessageSv(error)).toBe(BANGKOK_LOCKOUT);
    expect(uploadRateLimitMessageSv(error)).toBe(BANGKOK_LOCKOUT);
    expect(BANGKOK_LOCKOUT).not.toContain("Försök igen");

    const stockholm = uploadRateLimitMessageSv({
      retryAt: RETRY_AT,
      timeZone: "Europe/Stockholm",
    });
    expect(stockholm).toBe(
      "Du har nått gränsen på 20 bilder per timme. Du kan fota igen kl. 02:05.",
    );
    expect(stockholm).not.toContain("Försök igen");
  });

  it("recognizes the error code without matching the message text", () => {
    const duck = {
      code: UPLOAD_RATE_LIMIT_CODE,
      retryAt: RETRY_AT,
      timeZone: "Asia/Bangkok",
      message: "För många bilder den här timmen. Försök igen senare.",
    };
    expect(uploadErrorMessageSv(duck)).toBe(BANGKOK_LOCKOUT);
    expect(uploadErrorMessageSv(duck)).not.toContain("Försök igen");
    expect(
      uploadErrorMessageSv(
        new Error("För många bilder den här timmen. Försök igen senare."),
      ),
    ).toBe(UPLOAD_SAVE_FAILED_SV);
  });

  it("throws the typed error from the upload path and keeps the cap at 20", () => {
    const src = readFileSync(
      new URL("../../lib/store/supabase-repository.ts", import.meta.url),
      "utf8",
    );
    const cap = src.slice(
      src.indexOf("UPLOAD_HOURLY_IMAGE_LIMIT"),
      src.indexOf("const dayAgo"),
    );
    expect(cap).toContain(">= UPLOAD_HOURLY_IMAGE_LIMIT");
    expect(cap).toContain("hourlyUploadsThatCount");
    expect(cap).toContain("raw_metadata");
    expect(cap).toContain("uploadRateLimitRetryAt");
    expect(cap).toContain("new UploadRateLimitError");
    expect(src).toContain("uploadLimitFlags");
    expect(src).toContain("const startedAt = new Date().toISOString()");
    expect(src).toContain("const finishedAt = new Date().toISOString()");
    expect(src.indexOf("const startedAt = new Date().toISOString()")).toBeLessThan(
      src.indexOf("await provider.extract"),
    );
    expect(src.indexOf("await provider.extract")).toBeLessThan(
      src.indexOf("const finishedAt = new Date().toISOString()"),
    );
    expect(src).toContain("started_at: startedAt");
    expect(src).toContain("finished_at: finishedAt");
    expect(src).not.toContain("started_at: recordedAt");
    expect(src).not.toContain("finished_at: recordedAt");
    expect(cap).not.toContain("För många bilder");
    expect(cap).not.toContain("Försök igen");
    expect(src).not.toContain(
      'throw new Error("För många bilder den här timmen. Försök igen senare.")',
    );
  });

  it("does not count model errors, empty reads, unknown results, or timeouts", () => {
    const rows = [
      {
        createdAt: "2026-09-28T00:00:00.000Z",
        rawMetadata: { countsTowardUploadLimit: false, ocrFailed: true, lastError: "timeout" },
      },
      {
        createdAt: "2026-09-28T00:10:00.000Z",
        rawMetadata: { countsTowardUploadLimit: false, detectedKind: "unknown" },
      },
      {
        createdAt: "2026-09-28T00:20:00.000Z",
        rawMetadata: { countsTowardUploadLimit: true, detectedKind: "receipt" },
      },
      {
        createdAt: "2026-09-28T00:30:00.000Z",
        rawMetadata: null,
      },
    ];
    const counting = hourlyUploadsThatCount(rows);
    expect(counting.map((row) => row.createdAt)).toEqual([
      "2026-09-28T00:20:00.000Z",
      "2026-09-28T00:30:00.000Z",
    ]);
    expect(
      uploadLimitFlags({
        provider: "vision_api",
        amountMinors: [],
        alreadyKnown: false,
        detectedKind: "unknown",
      }),
    ).toEqual({ ocrFailed: true, countsTowardUploadLimit: false });
    expect(
      uploadLimitFlags({
        provider: "vision_api",
        amountMinors: [6_100],
        alreadyKnown: false,
        detectedKind: "unknown",
      }).countsTowardUploadLimit,
    ).toBe(false);
    expect(
      uploadLimitFlags({
        provider: "vision_api",
        amountMinors: [6_100],
        alreadyKnown: false,
        detectedKind: "receipt",
      }),
    ).toEqual({ ocrFailed: false, countsTowardUploadLimit: true });
    expect(
      uploadLimitFlags({
        provider: "none",
        amountMinors: [],
        alreadyKnown: false,
        detectedKind: null,
      }).countsTowardUploadLimit,
    ).toBe(true);
    expect(
      uploadLimitFlags({
        provider: "vision_api",
        amountMinors: [],
        alreadyKnown: true,
        detectedKind: "bank_app_detail",
      }).countsTowardUploadLimit,
    ).toBe(true);
    expect(
      uploadLimitFlags({
        provider: "vision_api",
        amountMinors: [24_800, 15_000, 50_000],
        alreadyKnown: false,
        detectedKind: "bank_app_list",
        groundingRejected: true,
      }),
    ).toEqual({ ocrFailed: true, countsTowardUploadLimit: false });
  });
});
