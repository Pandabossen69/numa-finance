import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("PWA viewport", () => {
  it("covers the notch and uses a translucent status bar on cream", () => {
    expect(src).toContain('viewportFit: "cover"');
    expect(src).toContain('statusBarStyle: "black-translucent"');
    expect(src).toContain('themeColor: "#eee9e0"');
    expect(src).not.toContain('statusBarStyle: "default"');
  });
});
