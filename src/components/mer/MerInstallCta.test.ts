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
  it("shows Installera NUMA whenever BIP is available — no host gate", () => {
    expect(src).toContain("promptInstall");
    expect(src).toContain('const canPrompt = promptStatus === "available"');
    expect(src).not.toContain("isCanonicalAppHost");
    expect(src).not.toContain("canNativeInstall");
    expect(src).toContain("Installera NUMA");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("DISMISS");
    expect(src).not.toContain("aria-modal");
  });

  it("keeps standalone calm and splits iOS / Android / desktop Chromium fallbacks", () => {
    expect(src).toContain("isStandaloneDisplay");
    expect(src).toContain("NUMA är en app här");
    expect(src).toContain("installGuideSteps");
    expect(src).toContain("installGuideTitle");
    expect(src).toContain("wantsProductionInstallAction");
    expect(src).toContain("Öppna {PRODUCTION_HOST} för att installera");
    expect(src).toContain('data-numa-install={canPrompt ? "bip" : platform}');
    expect(src).not.toContain("På iPhone:");
    expect(src).not.toContain("På Android:");
  });

  it("captures BIP on the root shell, not only after Mer mounts", () => {
    expect(capture).toContain("beginInstallPromptCapture");
    expect(layout).toContain("InstallPromptCapture");
    expect(layout.indexOf("<InstallPromptCapture")).toBeLessThan(
      layout.indexOf("{children}"),
    );
  });

  it("keeps install actions at a 44px tap target", () => {
    expect(src).toContain("inline-flex min-h-11 w-full items-center justify-center");
  });

  it("sits on Mer as an in-flow section, not a Hem overlay", () => {
    expect(mer).toContain("MerInstallCta");
    expect(mer).toContain("Som app");
    expect(mer).not.toContain("HomescreenInstallHint");
    expect(mer).not.toContain("md:hidden");
    expect(mer).not.toContain("På telefonen (alla konton)");
  });
});
