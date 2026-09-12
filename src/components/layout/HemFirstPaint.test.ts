import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HemFirstPaint.tsx", import.meta.url), "utf8");
const slot = readFileSync(new URL("./LoadingSlot.tsx", import.meta.url), "utf8");
const mainLoading = readFileSync(
  new URL("../../app/(main)/loading.tsx", import.meta.url),
  "utf8",
);

describe("Hem first paint", () => {
  it("paints session shell or skeleton, never hydrate alone as live money", () => {
    expect(src).toContain("lastHomeShellSnapshot");
    expect(src).toContain("cookieShell");
    expect(src).toContain("seedHomeLoginShell");
    expect(src).not.toContain("readLastHomeCookieFromDocument");
    expect(src).not.toContain("lastHomeSnapshot()");
    expect(src).toContain("HomeViewLoading");
    expect(src).toContain("HomeDashboard");
    expect(src).toContain("adoptSnap={false}");
    expect(src).not.toContain("HemPending");
    expect(src).not.toContain("AnalysViewLoading");
  });

  it("marks the server loading slot so SSR dest-loading can replace it", () => {
    expect(slot).toContain("data-numa-view-loading");
    expect(slot).not.toContain("use client");
    expect(mainLoading).toContain("LoadingSlot");
    expect(mainLoading).toContain("MainFirstPaint");
    expect(mainLoading).toContain("readLastHomeCookie");
    expect(mainLoading).not.toContain("ViewLoading");
  });
});
