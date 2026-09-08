import { describe, expect, it } from "vitest";
import {
  holdKey,
  isHoldRoot,
  isNavActive,
  isTabRoot,
  optimisticNavPath,
  PRIMARY_NAV,
  primaryTab,
} from "./nav";

describe("optimisticNavPath", () => {
  it("uses the pending href while still on the page that was clicked", () => {
    expect(
      optimisticNavPath("/idag", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
  });

  it("keeps last intent after a stale intermediate URL lands", () => {
    expect(
      optimisticNavPath("/plan", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
    expect(
      optimisticNavPath("/analys", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
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

describe("isTabRoot", () => {
  it("treats only Mer hub as a cacheable tab root", () => {
    expect(isTabRoot("/mer")).toBe(true);
    expect(isTabRoot("/konton")).toBe(false);
    expect(isTabRoot("/konton/ny")).toBe(false);
    expect(isTabRoot("/idag")).toBe(true);
    expect(isTabRoot("/plan")).toBe(true);
    expect(isTabRoot("/analys")).toBe(true);
    expect(isTabRoot("/fota")).toBe(true);
  });
});

describe("holdKey / isHoldRoot", () => {
  it("holds Konton and Transaktioner as their own dest, not Mer", () => {
    expect(holdKey("/konton")).toBe("/konton");
    expect(holdKey("/transaktioner")).toBe("/transaktioner");
    expect(holdKey("/konton/ny")).toBe("/mer");
    expect(isHoldRoot("/konton")).toBe(true);
    expect(isHoldRoot("/transaktioner")).toBe(true);
    expect(isHoldRoot("/fota")).toBe(true);
    expect(isHoldRoot("/konton/ny")).toBe(false);
    expect(isHoldRoot("/importera")).toBe(false);
  });
});

describe("PRIMARY_NAV copy", () => {
  it("keeps the Plan chip hint off leftover Saldo wording", () => {
    const plan = PRIMARY_NAV.find((item) => item.href === "/plan");
    expect(plan?.hint).toBe("Plan och sparande");
    expect(PRIMARY_NAV.some((item) => item.hint.includes("Saldo och"))).toBe(
      false,
    );
  });
});
