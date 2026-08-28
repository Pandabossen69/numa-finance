import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const remote = readFileSync(
  new URL("../../lib/store/supabase-repository.ts", import.meta.url),
  "utf8",
);
const local = readFileSync(
  new URL("../../lib/store/local-repository.ts", import.meta.url),
  "utf8",
);

describe("OCR upload is rate-limited before OpenAI", () => {
  it("counts recent observations and stops at the hourly cap", () => {
    expect(remote).toContain("assertOcrRateAllowed");
    expect(remote).toContain("ocrWindowStartIso");
    expect(remote).toContain("isOcrOverLimit");
    expect(remote.indexOf("assertOcrRateAllowed")).toBeLessThan(
      remote.indexOf("provider.extract"),
    );
    expect(local).toContain("isOcrOverLimit");
    expect(local.indexOf("isOcrOverLimit")).toBeLessThan(
      local.indexOf("provider.extract"),
    );
  });

  it("times out a hung vision read in Swedish", () => {
    expect(remote).toContain("OCR_EXTRACT_TIMEOUT_MS");
    expect(remote).toContain("OCR_EXTRACT_TIMEOUT_SV");
    expect(local).toContain("OCR_EXTRACT_TIMEOUT_SV");
    expect(action).toContain("uploadReceiptAndExtract");
  });
});
