import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/analys loading shell", () => {
  it("streams last-known money or AnalysPending, never empty mint cards", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("AnalysDashboard");
    expect(page).toContain("readLastHomeCookie");
    expect(page).toContain("AnalysPending");
    expect(page).not.toContain("route-islands");
    expect(page).not.toContain("AnalysViewLoading");
    expect(loading).toContain("readLastHomeCookie");
    expect(loading).toContain("AnalysPending");
    expect(loading).not.toContain("AnalysViewLoading");
  });
});
