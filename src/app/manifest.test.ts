import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const src = readFileSync(new URL("./manifest.ts", import.meta.url), "utf8");

describe("PWA manifest", () => {
  it("stays same-origin so home-screen install works on this host", () => {
    const web = manifest();
    expect(web.id).toBe("/");
    expect(web.start_url).toBe("/idag");
    expect(web.scope).toBe("/");
    expect(web.display).toBe("standalone");
    expect(web.background_color).toBe("#ece4d6");
    expect(src).not.toContain("PRODUCTION_ORIGIN");
  });
});
