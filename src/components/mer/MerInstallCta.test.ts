import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MerInstallCta.tsx", import.meta.url), "utf8");
const mer = readFileSync(new URL("./MerScreen.tsx", import.meta.url), "utf8");
const capture = readFileSync(
  new URL("../pwa/InstallPromptCapture.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");

describe("Mer install CTA", () => {
  it("wires beforeinstallprompt to a Swedish Installera NUMA button", () => {
    expect(src).toContain("promptInstall");
    expect(src).toContain("readInstallPromptStatus");
    expect(src).toContain("Installera NUMA");
    expect(src).toContain("canPrompt");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("DISMISS");
    expect(src).not.toContain("aria-modal");
    expect(src).not.toContain('position: "fixed"');
  });

  it("keeps standalone calm and uses platform steps when BIP is missing", () => {
    expect(src).toContain("isStandaloneDisplay");
    expect(src).toContain("NUMA är en app här");
    expect(src).toContain("Inget mer behövs.");
    expect(src).toContain("installGuideSteps");
    expect(src).toContain("readInstallPlatform");
    expect(src).not.toContain("Dela → Lägg till på hemskärmen.");
  });

  it("captures BIP on the root shell, not only after Mer mounts", () => {
    expect(capture).toContain("beginInstallPromptCapture");
    expect(layout).toContain("InstallPromptCapture");
    expect(layout.indexOf("<InstallPromptCapture")).toBeLessThan(
      layout.indexOf("{children}"),
    );
  });

  it("keeps the production-host and install buttons at a 44px tap target", () => {
    expect(src).toContain("inline-flex min-h-11 w-full items-center justify-center");
    expect(src).toContain("Öppna {PRODUCTION_HOST}");
  });

  it("sits on Mer as an in-flow section, not a Hem overlay", () => {
    expect(mer).toContain("MerInstallCta");
    expect(mer).toContain("Som app");
    expect(mer).not.toContain("HomescreenInstallHint");
    expect(mer).not.toContain("md:hidden");
    expect(mer).not.toContain("På telefonen (alla konton)");
  });
});
