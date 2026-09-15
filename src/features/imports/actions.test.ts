import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("import confirm", () => {
  it("maps a duplicate OCR fingerprint to Swedish copy instead of a raw DB error", () => {
    const confirm = src.slice(
      src.indexOf("export async function confirmReceiptExpenseAction"),
    );
    expect(confirm).toContain("isUniqueViolationMessage");
    expect(confirm).toContain("swedishFingerprintConflictError");
    expect(confirm).toContain('void reportError("ocr.confirm"');
  });
});

describe("import upload error classification", () => {
  it("skips Sentry for expected image validation and keeps ocr.upload for unexpected errors", () => {
    const upload = src.slice(
      src.indexOf("export async function uploadReceiptAction"),
      src.indexOf("export async function confirmReceiptExpenseAction"),
    );
    expect(upload).toContain("isExpectedImageValidationError");
    expect(upload).toContain('void reportError("ocr.upload"');
    expect(upload).toContain("if (!isExpectedImageValidationError(error))");
  });
});
