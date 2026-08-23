import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/fota resume", () => {
  it("loads the pending observation into the capture flow", () => {
    expect(src).toContain("observation");
    expect(src).toContain("loadCaptureResume");
    expect(src).toContain("initialPreview");
    expect(src).toContain("resume?.mode");
    expect(src).toContain("obs:${observationId}");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(src).toContain("numa-page-wide");
  });
});
