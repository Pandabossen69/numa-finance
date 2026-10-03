import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CLIENT_UPLOAD_BUDGET_BYTES,
  IMAGE_TOO_BIG_SV,
  IMAGE_UNREADABLE_SV,
  TEXT_MAX_EDGE,
  downscaleFactor,
} from "./upload-limits";

describe("upload limits", () => {
  it("never upscales and fits a phone screenshot inside the OCR edge", () => {
    expect(downscaleFactor(800, TEXT_MAX_EDGE)).toBe(1);
    expect(downscaleFactor(2532, TEXT_MAX_EDGE)).toBeCloseTo(2400 / 2532);
    expect(downscaleFactor(4000, 2000)).toBe(0.5);
  });

  it("keeps the client payload under Vercel's request cap", () => {
    expect(CLIENT_UPLOAD_BUDGET_BYTES).toBeLessThan(4_500_000);
    expect(IMAGE_TOO_BIG_SV).toBe(
      "Bilden är för stor. Prova en skärmdump eller en mindre bild.",
    );
    expect(IMAGE_UNREADABLE_SV).toBe(
      "Bilden kunde inte läsas. Prova en skärmdump eller JPEG.",
    );
  });

  it("raises the server action body limit above the 1 MB default", () => {
    const config = readFileSync(
      new URL("../../../next.config.ts", import.meta.url),
      "utf8",
    );
    expect(config).toContain('bodySizeLimit: "12mb"');
  });
});
