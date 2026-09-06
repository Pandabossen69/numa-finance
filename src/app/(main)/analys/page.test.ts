import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/analys loading shell", () => {
  it("streams Analys behind Suspense so the shell is not blocked on the snapshot", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("AnalysDashboard");
    expect(page).toContain("route-islands");
    expect(loading).toContain("AnalysViewLoading");
  });
});
