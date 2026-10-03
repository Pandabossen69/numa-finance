import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./ReceiptCaptureFlow.tsx", import.meta.url), "utf8");

describe("ReceiptCaptureFlow copy wiring", () => {
  it("catches an oversized upload in the form instead of the error page", () => {
    const onFile = src.slice(src.indexOf("function onFile"), src.indexOf("function onConfirm"));
    expect(onFile).toContain("compressImageForUpload");
    expect(onFile).toContain("ImagePrepareError");
    expect(onFile).toContain("IMAGE_TOO_BIG_SV");
    expect(onFile).toContain("await uploadReceiptAction(fd)");
    expect(onFile.indexOf("try {")).toBeLessThan(onFile.indexOf("await uploadReceiptAction(fd)"));
    expect(onFile.indexOf("await uploadReceiptAction(fd)")).toBeLessThan(
      onFile.indexOf("} catch (error)"),
    );
  });

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
    expect(src).toContain("ONBOARDING_SV.fotaPickTitle");
    expect(src).toContain("ONBOARDING_SV.fotaPickHint");
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

  it("resets the kept-alive panel after Bekräfta so the next visit is the picker", () => {
    const confirm = src.slice(
      src.indexOf("function onConfirm"),
      src.indexOf('if (mode === "pick")'),
    );
    const resetAt = confirm.indexOf("resetToPick()");
    expect(resetAt).toBeGreaterThan(-1);
    expect(resetAt).toBeLessThan(confirm.indexOf("goHomeInstant"));
    expect(resetAt).toBeLessThan(confirm.indexOf("router.push(successHref)"));
    expect(confirm).not.toContain("URL.revokeObjectURL(preview.previewUrl)");
    expect(confirm.indexOf("paintConfirmedCapture")).toBeLessThan(
      confirm.indexOf("await confirmReceiptExpenseAction"),
    );
    expect(confirm.indexOf("confirmOptimisticQuickAdd")).toBeGreaterThan(
      confirm.indexOf("await confirmReceiptExpenseAction"),
    );
    expect(confirm.indexOf("confirmOptimisticQuickAdd")).toBeLessThan(
      confirm.indexOf("goHomeInstant"),
    );
    expect(confirm).toContain("rollbackOptimisticQuickAdd");
  });

  it("returns Manuellt to the picker before leaving for Hem", () => {
    const success = src.slice(
      src.indexOf("onSuccess={() => {"),
      src.indexOf("if (scanning"),
    );
    expect(success.indexOf("resetToPick()")).toBeGreaterThan(-1);
    expect(success.indexOf("resetToPick()")).toBeLessThan(
      success.indexOf("goHomeInstant"),
    );
  });

  it("sends the resolved account when a bank-app screenshot is confirmed", () => {
    expect(src).toContain("accountId: chosenAccountId");
    expect(src).toContain("chooseCaptureAccount");
    expect(src).not.toContain('preview.importKind === "bank_app" ? null');
  });

  it("shows a capture failure as text, with manual entry and no Försök igen button", () => {
    expect(src).toContain('role="alert"');
    expect(src).toContain("{error}");
    expect(src).toContain("Skriv manuellt");
    expect(src).toContain('setMode("manual")');
    expect(src).not.toContain("RetryLoadButton");
    expect(src).not.toMatch(/<button[^>]*>[\s\S]{0,40}Försök igen/);
    expect(src).toContain('title: "Manuellt"');
  });

  it("marks last-used and the fastest Fota path without hiding other methods", () => {
    expect(src).toContain("fotaPickerMark");
    expect(src).toContain("rememberLastCaptureMethod");
    expect(src).toContain("readLastCaptureMethod");
    expect(src).toContain("subscribeLastCaptureMethod");
    expect(src).toContain("lastUsed={lastUsed}");
    expect(src).toContain("FASTEST_CAPTURE_METHOD");
    expect(src).toContain("numa-panel-strong");
    expect(src).toContain("whitespace-nowrap");
    expect(src).toContain("Bank-SMS");
    expect(src).toContain("Bankapp");
    expect(src).toContain("Kvitto");
    expect(src).toContain("Manuellt");
    expect(src).toContain("onboarding ? null : fotaPickerMark");
  });

  it("caps the Datum field at today in the profile time zone", () => {
    expect(src).toContain("max={today}");
    expect(src).toContain("clampCaptureDateInput");
    expect(src).toContain("calendarDateInZone");
    expect(src).toContain("captureProfileTimeZone");
  });
});
