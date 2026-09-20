import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HemFirstPaint.tsx", import.meta.url), "utf8");
const slot = readFileSync(new URL("./LoadingSlot.tsx", import.meta.url), "utf8");
const mainLoading = readFileSync(
  new URL("../../app/(main)/loading.tsx", import.meta.url),
  "utf8",
);

describe("Hem first paint", () => {
  it("paints session-confirmed Hem only, never hydrate/cookie as live money", () => {
    expect(src).toContain("lastSessionHomeSnapshot");
    expect(src).not.toContain("readLastHomeCookieFromDocument");
    expect(src).not.toContain("lastHomeSnapshot()");
    expect(src).toContain("HemPending");
    expect(src).toContain("HomeDashboard");
    expect(src).not.toContain("HomeViewLoading");
    expect(src).not.toContain("AnalysViewLoading");
  });

  it("gap-fills Analys dest-loading from Plan + Hem so the timeout banner stays off", () => {
    expect(src).toContain("ensurePaintableAnalysSnapshot");
    expect(src).toContain("lastPlanSnapshot");
    expect(src).toContain("lastHomeSnapshot");
    expect(src).toContain("subscribePlanSnapshot");
    expect(src).toContain("analysViewCanPaint");
  });

  it("marks the server loading slot so SSR dest-loading can replace it", () => {
    expect(slot).toContain("data-numa-view-loading");
    expect(slot).not.toContain("use client");
    expect(mainLoading).toContain("LoadingSlot");
    expect(mainLoading).toContain("MainFirstPaint");
    expect(mainLoading).not.toContain("ViewLoading");
  });
});
