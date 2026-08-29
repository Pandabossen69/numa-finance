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
  it("paints AppShell without awaiting session or profile", () => {
    expect(layout).toContain("export default function MainLayout");
    expect(layout).not.toContain("export default async function MainLayout");
    expect(layout).toContain("AppShell");
    expect(layout).toContain("redirectIfOnboardingIncomplete");
    expect(layout).toContain("OnboardingRedirect");
    expect(layout).toContain("ShellDisplayName");
    expect(layout).toContain("<Suspense fallback={null}>");
    expect(layout).toContain("ShellDisplayNameFallback");
    expect(layout).toContain("chromeDisplayName");
    expect(layout).toContain("SessionOwnerBinder");
    expect(layout).not.toContain("Användare");
  });

  it("keeps loading.tsx as content-only so the shell is not nested", () => {
    expect(loading).toContain("ViewLoading");
    expect(loading).not.toContain("AppShell");
    expect(idagLoading).toContain("HomeViewLoading");
    expect(idag).not.toContain("Suspense");
  });
});
