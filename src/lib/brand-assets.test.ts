import { describe, expect, it } from "vitest";
import {
  BRAND_APPLE_TOUCH,
  BRAND_FAVICON,
  BRAND_ICON_192,
  BRAND_MARK,
  brandAsset,
} from "./brand-assets";

describe("brandAsset cache bust", () => {
  it("appends a version query so Safari cannot keep the old owl forever", () => {
    expect(brandAsset("/icons/mark.png")).toMatch(/^\/icons\/mark\.png\?v=/);
    expect(BRAND_MARK).toContain("/icons/mark.png?v=");
    expect(BRAND_ICON_192).toContain("/icons/icon-192.png?v=");
    expect(BRAND_APPLE_TOUCH).toContain("/apple-touch-icon.png?v=");
    expect(BRAND_FAVICON).toContain("/favicon.ico?v=");
  });
});
