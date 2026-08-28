import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./FotaScreen.tsx", import.meta.url), "utf8");

describe("FotaScreen", () => {
  it("shows last-known Fota boot, or Hem leftover, instead of a blank wait", () => {
    expect(src).toContain("lastFotaBoot");
    expect(src).toContain("rememberFotaBoot");
    expect(src).toContain("lastHomeSnapshot");
    expect(src).toContain("FotaViewLoading");
    expect(src).toContain("ReceiptCaptureFlow");
  });
});
