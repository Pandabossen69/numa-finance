import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const screen = readFileSync(
  new URL("../../../components/capture/FotaScreen.tsx", import.meta.url),
  "utf8",
);

describe("/fota resume", () => {
  it("loads the pending observation into the capture flow", () => {
    expect(src).toContain("observation");
    expect(src).toContain("loadCaptureResume");
    expect(src).toContain("initialPreview");
    expect(src).toContain("resume?.mode");
    expect(screen).toContain("obs:${observationId}");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(screen).toContain("numa-page-wide");
    expect(screen).toContain("overflow-x-hidden");
  });

  it("streams last-known Fota while the snapshot loads", () => {
    expect(src).toContain("Suspense");
    expect(src).toContain("FotaScreen");
    expect(src).toContain("loadCaptureResume");
    expect(src).toContain("initialPreview");
  });
});
