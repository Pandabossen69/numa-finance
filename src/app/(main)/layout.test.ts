import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const homeCookieServer = readFileSync(
  new URL("../../features/home/last-home-cookie.server.ts", import.meta.url),
  "utf8",
);
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const idag = readFileSync(new URL("./idag/page.tsx", import.meta.url), "utf8");
const idagLoading = readFileSync(
  new URL("./idag/loading.tsx", import.meta.url),
  "utf8",
);

describe("main first-load chrome", () => {
  it("awaits Hem shell then paints AppShell (SPEC 6b/6d SSR)", () => {
    expect(layout).toContain("export default async function MainLayout");
    expect(layout).toContain("resolveHomeShell");
    expect(layout).toContain("homeCookieShell");
    expect(layout).toContain("AppShell");
    expect(layout).toContain("redirectIfOnboardingIncomplete");
    expect(layout).toContain("OnboardingRedirect");
    expect(layout).toContain("ShellDisplayName");
    expect(layout).toContain("<Suspense fallback={null}>");
    expect(layout).toContain("ShellDisplayNameFallback");
    expect(layout).toContain("chromeDisplayName");
    expect(layout).toContain("SessionOwnerBinder");
    expect(layout).not.toContain("Användare");
    expect(homeCookieServer).toContain("lastHomeCookieForSession");
    expect(homeCookieServer).toContain("getSessionUser");
    expect(homeCookieServer).toContain("Promise.all([cookies(), getSessionUser()])");
    expect(homeCookieServer).toContain("resolveHomeShell");
    expect(homeCookieServer).toContain("loadHomeSnapshot");
    expect(homeCookieServer).toContain("toLastHomeCookieShell");
    expect(homeCookieServer).not.toContain("getVerifiedAuthUser");
    expect(homeCookieServer).not.toContain("getProfile");
    expect(homeCookieServer).not.toContain("auth.getUser()");
  });

  it("keeps loading.tsx as content-only so the shell is not nested", () => {
    expect(loading).toContain("LoadingSlot");
    expect(loading).toContain("MainFirstPaint");
    expect(loading).not.toContain("ViewLoading");
    expect(loading).not.toContain("AppShell");
    expect(idagLoading).toContain("LoadingSlot");
    expect(idagLoading).toContain("HemFirstPaint");
    expect(idag).toContain("HemRouteClient");
    expect(idag).not.toContain("Suspense");
    expect(idag).not.toContain("AppShell");
  });
});
