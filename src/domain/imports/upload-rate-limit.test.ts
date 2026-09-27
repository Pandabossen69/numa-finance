import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UPLOAD_SAVE_FAILED_SV, uploadErrorMessageSv } from "./candidate-reuse";
import {
  UPLOAD_HOURLY_IMAGE_LIMIT,
  UPLOAD_RATE_LIMIT_CODE,
  UploadRateLimitError,
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
    expect(cap).toContain('order("created_at", { ascending: true })');
    expect(cap).toContain("uploadRateLimitRetryAt");
    expect(cap).toContain("new UploadRateLimitError");
    expect(cap).not.toContain("För många bilder");
    expect(cap).not.toContain("Försök igen");
    expect(src).not.toContain(
      'throw new Error("För många bilder den här timmen. Försök igen senare.")',
    );
  });
});
