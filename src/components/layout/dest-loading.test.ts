import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./dest-loading.tsx", import.meta.url), "utf8");

describe("destLoadingForTab", () => {
  it("paints last-known screens, not empty skeletons, for every instant dest", () => {
    expect(src).toContain('case "/idag"');
    expect(src).toContain("<HomeDashboard snap={null} error={null} />");
    expect(src).toContain('case "/plan"');
    expect(src).toContain("<PlanScreen />");
    expect(src).toContain('case "/analys"');
    expect(src).toContain("<AnalysDashboard data={null} />");
    expect(src).toContain('case "/mer"');
    expect(src).toContain("<MerScreen data={null} />");
    expect(src).toContain('case "/transaktioner"');
    expect(src).toContain('from "@/components/movements/MovementsScreen"');
    expect(src).toContain("<MovementsScreen data={null} />");
    expect(src).toContain('case "/konton"');
    expect(src).toContain("<AccountsDashboard data={null} />");
    expect(src).toContain('case "/fota"');
    expect(src).toContain("<FotaScreen data={null} />");
    expect(src).not.toContain("HomeViewLoading");
    expect(src).not.toContain("AnalysViewLoading");
  });
});
