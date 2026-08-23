import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./ReceiptCaptureFlow.tsx", import.meta.url), "utf8");

describe("ReceiptCaptureFlow copy wiring", () => {
  it("uses shared CAPTURE_UI_COPY so Kvitto stays receipt-specific", () => {
    expect(src).toContain("CAPTURE_UI_COPY");
    expect(src).toContain("copy.camera");
    expect(src).toContain("copy.gallery");
    expect(src).toContain("initialPreview");
    expect(src).not.toMatch(/isSms \|\| isBankApp \? "Fota skärmen/);
    expect(src).not.toMatch(/isSms \|\| isBankApp \? "Välj skärmdump/);
  });
});
