import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const hemClient = readFileSync(
  new URL("../../../components/home/HemRouteClient.tsx", import.meta.url),
  "utf8",
);
const homeSnapshot = readFileSync(
  new URL("../../../features/finance/home-snapshot.ts", import.meta.url),
  "utf8",
);

describe("/idag first paint", () => {
  it("paints Hem client-first so the shell is not blocked on the snapshot", () => {
    expect(page).toContain("HemRouteClient");
    expect(page).not.toContain("Suspense");
    expect(page).not.toContain("IdagBody");
    // Cookie SSR lives in layout → TabKeepAlive, not the thin page.
    expect(page).not.toContain("readLastHomeCookie");
    expect(page).not.toContain("route-islands");
    expect(page).not.toContain("HomeViewLoading");
    expect(hemClient).toContain("HemFirstPaint");
    expect(hemClient).toContain("HomeDashboard");
    expect(hemClient).toContain("fetchHomeSnapshot");
    expect(hemClient).toContain("lastSessionHomeSnapshot");
    expect(hemClient).toContain("lastHomeSnapshot");
    expect(hemClient).toContain("cookieShell");
    expect(hemClient).toContain("seedHomeLoginShell");
    expect(hemClient).not.toContain("readLastHomeCookie");
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("HemFirstPaint");
    expect(loading).toContain("readLastHomeCookie");
    expect(loading).not.toContain("HomeViewLoading");
    expect(loading).not.toContain("ViewLoading");
  });

  it("does not block Hem money on accounts or Kom igång", () => {
    expect(page).not.toContain("loadGettingStartedView");
    expect(page).not.toContain("loadAccountsSnapshot");
    expect(hemClient).not.toContain("loadGettingStartedView");
    expect(hemClient).not.toContain("loadAccountsSnapshot");
    expect(hemClient).toContain("fetchHomeSnapshot");
    expect(homeSnapshot).toContain("loadHomeSnapshot");
  });
});
