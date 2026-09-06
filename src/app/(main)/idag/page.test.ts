import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/idag first paint", () => {
  it("streams Hem behind Suspense so the shell is not blocked on the snapshot", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("HomeDashboard");
    expect(page).toContain("route-islands");
    expect(loading).toContain("HomeViewLoading");
  });

  it("shows Kom igång on Hem for new users", () => {
    expect(page).toContain("loadGettingStartedView");
    expect(page).toContain("gettingStarted");
  });
});
