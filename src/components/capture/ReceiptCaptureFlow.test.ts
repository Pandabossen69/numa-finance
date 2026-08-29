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

  it("teaches Fota in one spoken Swedish sentence, never as a Kom igång tour", () => {
    expect(src).toContain("SV.fotaHint");
    expect(src).not.toContain('"Kom igång"');
    expect(src).not.toContain("Börja här");
    expect(src).not.toMatch(/välkommen/i);
  });

  it("paints remaining-overspend in clay alarm, not destroy red", () => {
    expect(src).toContain('text-[var(--numa-alarm)]');
    expect(src).not.toMatch(/impact\.remaining < 0[\s\S]{0,80}numa-danger/);
    expect(src).toContain("formatMoney(money(impact.remaining, currency))");
    expect(src).not.toContain("Math.max(0, impact.remaining)");
  });

  it("keeps Fota amounts and category chips from wrapping or shrinking unequally", () => {
    expect(src).toContain("numa-hero-money");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("numa-chip-scroll");
    expect(src).toContain("numa-tap");
    expect(src).toContain("h-11 w-11");
    expect(src).not.toContain("h-8 w-8");
  });
});
