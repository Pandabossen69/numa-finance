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

  it("reuses confirm + navigate for onboarding saldo instead of a second write path", () => {
    expect(src).toContain('variant?: "default" | "onboarding"');
    expect(src).toContain("fromOnboarding");
    expect(src).toContain("successHref");
    expect(src).toContain("Spara saldo");
  });

  it("paints remaining-overspend in clay alarm, not destroy red", () => {
    expect(src).toContain('text-[var(--numa-alarm)]');
    expect(src).not.toMatch(/impact\.remaining < 0[\s\S]{0,80}numa-danger/);
  });
});
