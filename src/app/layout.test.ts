import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("PWA viewport", () => {
  it("covers the notch and uses a translucent status bar on cream", () => {
    expect(src).toContain('viewportFit: "cover"');
    expect(src).toContain('statusBarStyle: "black-translucent"');
    expect(src).toContain('themeColor: "#ece4d6"');
    expect(src).not.toContain('statusBarStyle: "default"');
  });

  it("points Safari and the tab icon at the owl brand art", () => {
    expect(src).toContain("/icons/icon-192.png");
    expect(src).toContain("/icons/icon-512.png");
    expect(src).toContain("/apple-touch-icon.png");
    expect(src).toContain("/favicon.ico");
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
