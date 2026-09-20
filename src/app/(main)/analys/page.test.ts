import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const routeClient = readFileSync(
  new URL("../../../components/analys/AnalysRouteClient.tsx", import.meta.url),
  "utf8",
);

describe("/analys loading shell", () => {
  it("paints last-known Analys client-first, never empty mint cards", () => {
    expect(page).toContain("AnalysRouteClient");
    expect(page).not.toContain("readLastHomeCookie");
    expect(page).not.toContain("route-islands");
    expect(page).not.toContain("AnalysViewLoading");
    expect(routeClient).toContain("lastAnalysSnapshot");
    expect(routeClient).toContain("getAnalysSnapshotAction");
    expect(routeClient).toContain("fetchAnalysSnapshotClient");
    expect(routeClient).toContain("scheduleQuietMenuWarm");
    expect(routeClient).toContain("analysViewCanPaint");
    expect(routeClient).toContain("lastAnalysFetchResult");
    expect(routeClient).toContain("analysSnapshotFromPlan");
    expect(routeClient).toContain("if (!analysActive) return");
    expect(routeClient).not.toContain("if (lastAnalysSnapshot()) return");
    expect(routeClient).not.toContain("if (!lastAnalysSnapshot()) setError");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("AnalysFirstPaint");
    expect(loading).not.toContain("AnalysViewLoading");
  });
});
