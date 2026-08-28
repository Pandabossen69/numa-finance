import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/idag first paint", () => {
  it("lets loading.tsx stream a Hem-shaped skeleton so LastViewOutlet can hold", () => {
    expect(page).not.toContain("Suspense");
    expect(page).toContain("HomeDashboard");
    expect(page).toContain("next/dynamic");
    expect(loading).toContain("HomeViewLoading");
  });

  it("shows Kom igång on Hem for new users", () => {
    expect(page).toContain("loadGettingStartedView");
    expect(page).toContain("gettingStarted");
  });
});
