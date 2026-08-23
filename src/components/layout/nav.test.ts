import { describe, expect, it } from "vitest";
import { isNavActive, optimisticNavPath, primaryTab } from "./nav";

describe("optimisticNavPath", () => {
  it("uses the pending href while still on the page that was clicked", () => {
    expect(
      optimisticNavPath("/idag", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
  });

  it("drops the pending href once the pathname has changed", () => {
    expect(
      optimisticNavPath("/plan", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
    expect(
      optimisticNavPath("/analys", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/analys");
  });

  it("falls back to the real pathname when nothing is pending", () => {
    expect(optimisticNavPath("/mer", null)).toBe("/mer");
  });
});

describe("isNavActive", () => {
  it("treats mer-prefixed routes as Mer", () => {
    expect(isNavActive("/konton", "/mer")).toBe(true);
    expect(isNavActive("/plan", "/mer")).toBe(false);
  });
});

describe("primaryTab", () => {
  it("keeps Mer children on Mer so drill-in is not held", () => {
    expect(primaryTab("/mer")).toBe("/mer");
    expect(primaryTab("/konton")).toBe("/mer");
    expect(primaryTab("/idag")).toBe("/idag");
    expect(primaryTab("/plan")).toBe("/plan");
    expect(primaryTab("/fota")).toBe("/fota");
  });
});
