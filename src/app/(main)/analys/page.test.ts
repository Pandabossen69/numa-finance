import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/analys loading shell", () => {
  it("lets loading.tsx stream an Analys-shaped skeleton so LastViewOutlet can hold", () => {
    expect(page).not.toContain("Suspense");
    expect(page).toContain("AnalysDashboard");
    expect(page).toContain("route-islands");
    expect(loading).toContain("AnalysViewLoading");
  });
});
