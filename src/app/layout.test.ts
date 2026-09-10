import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("PWA viewport", () => {
  it("covers the notch and uses a translucent status bar on the dark shell", () => {
    expect(src).toContain('viewportFit: "cover"');
    expect(src).toContain('statusBarStyle: "black-translucent"');
    expect(src).toContain('themeColor: "#05090b"');
    expect(src).toContain('colorScheme: "dark"');
    expect(src).not.toContain('statusBarStyle: "default"');
  });

  it("points Safari and the tab icon at the Steel + Orange brand art", () => {
    expect(src).toContain("BRAND_ICON_192");
    expect(src).toContain("BRAND_ICON_512");
    expect(src).toContain("BRAND_APPLE_TOUCH");
    expect(src).toContain("BRAND_FAVICON");
    expect(src).toContain("@/lib/brand-assets");
  });
});

describe("root font loading", () => {
  it("preloads only the UI face and keeps money mono off the critical path", () => {
    expect(src).toContain("next/font/google");
    expect(src).toContain('weight: "variable"');
    expect(src).toMatch(/JetBrains_Mono\([\s\S]*weight: "variable"/);
    expect(src).toContain("preload: true");
    expect(src).toContain("preload: false");
    expect(src).not.toContain("fonts.googleapis.com");
    expect(src).not.toMatch(/JetBrains_Mono\([\s\S]*preload:\s*true/);
  });
});
