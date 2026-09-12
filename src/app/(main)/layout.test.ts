import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const idag = readFileSync(new URL("./idag/page.tsx", import.meta.url), "utf8");
const idagLoading = readFileSync(
  new URL("./idag/loading.tsx", import.meta.url),
  "utf8",
);

describe("main first-load chrome", () => {
  it("paints AppShell without awaiting session, profile, or last-home cookie", () => {
    expect(layout).toContain("export default function MainLayout");
    expect(layout).not.toContain("export default async function MainLayout");
    expect(layout).toContain("AppShell");
    expect(layout).toContain("readLastHomeCookie");
    expect(layout).toContain("HomeCookieSeed");
    expect(layout).toContain("HomeCookieSeedFromServer");
    expect(layout).toContain("redirectIfOnboardingIncomplete");
    expect(layout).toContain("OnboardingRedirect");
    expect(layout).toContain("ShellDisplayName");
    expect(layout).toContain("<Suspense fallback={null}>");
    // Cookie must not gate AppShell mount (blank login→Hem).
    expect(layout).not.toContain("homeCookieShell={");
    expect(layout).not.toContain("MainLayoutWithCookie");
    expect(layout).toContain("ShellDisplayNameFallback");
    expect(layout).toContain("chromeDisplayName");
    expect(layout).toContain("SessionOwnerBinder");
    expect(layout).not.toContain("Användare");
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
