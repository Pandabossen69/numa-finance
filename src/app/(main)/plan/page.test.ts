import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const screen = readFileSync(
  new URL("../../../components/plan/PlanScreen.tsx", import.meta.url),
  "utf8",
);
const routeClient = readFileSync(
  new URL("../../../components/plan/PlanRouteClient.tsx", import.meta.url),
  "utf8",
);
const warmup = readFileSync(
  new URL("../../../components/plan/load-plan.ts", import.meta.url),
  "utf8",
);

describe("/plan getting-started hints", () => {
  it("opens the matching add form and keeps one spoken Swedish hint", () => {
    expect(page).toContain("PlanRouteClient");
    expect(page).not.toContain("await searchParams");
    expect(page).not.toMatch(/välkommen/i);
    expect(routeClient).toContain('steg === "inkomst"');
    expect(routeClient).toContain('steg === "utgift"');
    expect(routeClient).toContain("Här lägger du in det som kommer in.");
    expect(routeClient).toContain("Här lägger du in det som måste betalas.");
    expect(routeClient).toContain("useSearchParams");
    expect(routeClient).toContain("focusAdd={focusAdd}");
    expect(routeClient).toContain("stepHint={stepHint}");
    expect(screen).toContain("Vad som kommer in och vad som måste ut.");
  });

  it("paints last-known Plan client-first and quiet-refreshes in the background", () => {
    expect(page).not.toContain("getCachedTodaySnapshot");
    expect(page).toContain("PlanRouteClient");
    expect(page).not.toContain("<Suspense fallback={<ViewLoading />}>");
    expect(routeClient).toContain("lastPlanSnapshot");
    expect(routeClient).toContain("if (lastPlanSnapshot()) return;");
    expect(routeClient).toContain("getPlanPageDataAction");
    expect(routeClient).toContain("rememberPlanSnapshot");
    expect(screen).toContain("lastPlanSnapshot");
    expect(screen).not.toContain("warmupPlanPageData");
    expect(warmup).toContain("loadPlanSnapshot");
    expect(warmup).toContain("Promise.all");
    expect(warmup).toContain("loadGettingStartedView");
  });
});
