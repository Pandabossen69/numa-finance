import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_ICON_192,
  BRAND_ICON_512,
  BRAND_ICON_MASKABLE_512,
} from "@/lib/brand-assets";
import manifest from "./manifest";

const src = readFileSync(new URL("./manifest.ts", import.meta.url), "utf8");

describe("PWA manifest", () => {
  it("stays same-origin so home-screen install works on this host", () => {
    const web = manifest();
    expect(web.id).toBe("/");
    expect(web.start_url).toBe("/idag");
    expect(web.scope).toBe("/");
    expect(web.display).toBe("standalone");
    expect(web.background_color).toBe("#05090b");
    expect(web.theme_color).toBe("#05090b");
    expect(web.icons?.map((icon) => icon.src)).toEqual([
      BRAND_ICON_192,
      BRAND_ICON_512,
      BRAND_ICON_MASKABLE_512,
    ]);
    expect(web.icons?.[0]?.src).toContain("/icons/icon-192.png?v=");
    expect(src).toContain("@/lib/brand-assets");
    expect(src).not.toContain("PRODUCTION_ORIGIN");
  });
});
