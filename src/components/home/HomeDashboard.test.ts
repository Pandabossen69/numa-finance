import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./HomeDashboard.tsx", import.meta.url), "utf8");

describe("Hem PWA hint and HIGH copy", () => {
  it("keeps the install hint below the dial as a compact bar", () => {
    expect(src).toContain('variant="bar"');
    expect(src.indexOf("DayDial")).toBeLessThan(src.lastIndexOf("HomescreenInstallHint"));
    expect(src).not.toMatch(/Lägg NUMA på hemskärmen/);
  });

  it("keeps the signed Över chip on the dial", () => {
    expect(src).toContain("Över");
    expect(src).toContain("numa-chip-alarm");
  });

  it("shows the Hem-shaped skeleton while snapshot is empty", () => {
    expect(src).toContain("HomeViewLoading");
  });

  it("does not show Mot planen as the Hem pile", () => {
    expect(src).toContain("CompactPiles");
    expect(src).toContain("overMinor");
    expect(src).not.toContain("livingSaldoMinor");
    expect(src).not.toContain("SV.motPlanen");
    expect(src).not.toContain("livingVsPlanHintSv");
  });
});
