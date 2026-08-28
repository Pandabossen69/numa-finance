import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PlanScreen.tsx", import.meta.url), "utf8");

describe("PlanScreen", () => {
  it("paints last-known Plan immediately and reconciles in the background", () => {
    expect(src).toContain("lastPlanSnapshot");
    expect(src).toContain("warmupPlanPageData");
    expect(src).toContain("PlanEditor");
    expect(src).toContain("route-islands");
    expect(src).toContain("Vad som kommer in och vad som måste ut.");
    expect(src).not.toContain("refreshQuiet");
    expect(src).not.toContain("router.refresh");
  });
});
