import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./route-islands.tsx", import.meta.url), "utf8");

describe("route islands", () => {
  it("lazy-loads Hem, Plan and Analys off the shared first JS", () => {
    expect(src).toContain("next/dynamic");
    expect(src).toContain("ssr: false");
    expect(src).toContain("HomeDashboard");
    expect(src).toContain("PlanEditor");
    expect(src).toContain("PlanScreen");
    expect(src).toContain("AnalysDashboard");
  });
});
