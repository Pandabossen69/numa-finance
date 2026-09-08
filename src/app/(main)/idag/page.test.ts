import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/idag first paint", () => {
  it("streams Hem behind Suspense so the shell is not blocked on the snapshot", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("HomeDashboard");
    expect(page).toContain("readLastHomeCookie");
    expect(page).toContain("HemPending");
    expect(page).not.toContain("route-islands");
    expect(page).not.toContain("HomeViewLoading");
    expect(loading).toContain("readLastHomeCookie");
    expect(loading).toContain("HemPending");
    expect(loading).not.toContain("HomeViewLoading");
  });

  it("does not block Hem money on accounts or Kom igång", () => {
    expect(page).not.toContain("loadGettingStartedView");
    expect(page).not.toContain("loadAccountsSnapshot");
    expect(page).toContain("loadHomeSnapshot");
  });
});
