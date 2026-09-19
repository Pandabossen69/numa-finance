import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AnalysRouteClient.tsx", import.meta.url), "utf8");

describe("AnalysRouteClient", () => {
  it("paints last-known / Plan-derived Analys and skips hidden keep-alive fetch", () => {
    expect(src).toContain("lastAnalysSnapshot");
    expect(src).toContain("lastPlanSnapshot");
    expect(src).toContain("analysSnapshotFromPlan");
    expect(src).toContain("lastSessionHomeSnapshot");
    expect(src).toContain("analysViewCanPaint");
    expect(src).toContain("if (!analysActive) return");
    expect(src).toContain("fetchAnalysSnapshotClient");
    expect(src).toContain("lastAnalysFetchResult");
    expect(src).toContain("getAnalysSnapshotAction");
    expect(src).not.toContain("if (lastAnalysSnapshot()) return");
    expect(src).not.toContain("if (!lastAnalysSnapshot()) setError");
    expect(src).toContain("<AnalysDashboard data={stored} error={error} />");
  });
});
