import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const screen = readFileSync(
  new URL("../../../components/plan/PlanScreen.tsx", import.meta.url),
  "utf8",
);
const warmup = readFileSync(
  new URL("../../../components/plan/load-plan.ts", import.meta.url),
  "utf8",
);

describe("/plan getting-started hints", () => {
  it("opens the matching add form and keeps one spoken Swedish hint", () => {
    expect(page).toContain("steg === \"inkomst\"");
    expect(page).toContain("steg === \"utgift\"");
    expect(page).toContain("Här lägger du in det som kommer in.");
    expect(page).toContain("Här lägger du in det som måste betalas.");
    expect(screen).toContain("Vad som kommer in och vad som måste ut.");
    expect(page).toContain("focusAdd={focusAdd}");
    expect(page).toContain("stepHint={hint}");
    expect(page).toContain("loadPlanSnapshot");
    expect(page).toContain("Promise.all");
    expect(page).toContain("loadGettingStartedView");
    expect(page).toContain("route-islands");
    expect(page).not.toMatch(/välkommen/i);
  });

  it("paints last-known Plan and reconciles the cached snapshot in parallel", () => {
    expect(page).not.toContain("getCachedTodaySnapshot");
    expect(page).toContain("PlanScreen");
    expect(screen).toContain("lastPlanSnapshot");
    expect(screen).toContain("warmupPlanPageData");
    expect(warmup).toContain("loadPlanSnapshot");
    expect(warmup).toContain("Promise.all");
    expect(warmup).toContain("loadGettingStartedView");
  });
});
