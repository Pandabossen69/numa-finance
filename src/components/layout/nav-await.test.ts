import { describe, expect, it } from "vitest";
import { isStaleNavArrival, optimisticNavPath } from "@/components/layout/nav";
import {
  destChildrenArrived,
  isOutletStale,
  lastNavIntent,
} from "@/components/layout/nav-await";
import { resolveVisibleTab } from "@/components/layout/view-hold";

const RAPID_TAPS = [
  { href: "/plan", fromPath: "/idag" },
  { href: "/mer", fromPath: "/idag" },
  { href: "/analys", fromPath: "/idag" },
  { href: "/idag", fromPath: "/analys" },
  { href: "/plan", fromPath: "/idag" },
  { href: "/analys", fromPath: "/plan" },
  { href: "/mer", fromPath: "/analys" },
  { href: "/idag", fromPath: "/mer" },
  { href: "/plan", fromPath: "/idag" },
  { href: "/analys", fromPath: "/plan" },
] as const;

describe("nav await contracts", () => {
  it("lets the last of at least 10 rapid intents win", () => {
    expect(RAPID_TAPS.length).toBeGreaterThanOrEqual(10);
    const last = lastNavIntent([...RAPID_TAPS]);
    expect(last).toEqual({ href: "/analys", fromPath: "/plan" });
    expect(optimisticNavPath("/idag", last)).toBe("/analys");
    expect(isStaleNavArrival("/plan", last)).toBe(true);
    expect(isStaleNavArrival("/analys", last)).toBe(false);
  });

  it("treats URL-ahead previous children as dest-loading or dest cache", () => {
    expect(
      isOutletStale({
        awaitHref: "/analys",
        pathTab: "/analys",
        destTab: "/analys",
        childrenFrozen: true,
      }),
    ).toBe(true);
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/analys",
        outletStale: true,
      }),
    ).toBe("dest-loading");
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: false,
        destTab: "/plan",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: true,
        pathTab: "/plan",
        outletStale: true,
      }),
    ).toBe("dest");
  });

  it("releases the dest shell only after dest children actually arrive", () => {
    expect(
      destChildrenArrived({
        awaitHref: "/plan",
        pathname: "/plan",
        childrenFrozen: true,
        hadFreeze: true,
      }),
    ).toBe(false);
    expect(
      destChildrenArrived({
        awaitHref: "/plan",
        pathname: "/plan",
        childrenFrozen: false,
        hadFreeze: true,
      }),
    ).toBe(true);
    expect(
      destChildrenArrived({
        awaitHref: "/plan",
        pathname: "/plan",
        childrenFrozen: false,
        hadFreeze: false,
      }),
    ).toBe(false);
    expect(
      destChildrenArrived({
        awaitHref: "/plan",
        pathname: "/analys",
        childrenFrozen: false,
        hadFreeze: true,
      }),
    ).toBe(false);
    expect(
      destChildrenArrived({
        awaitHref: "/plan",
        pathname: "/plan",
        childrenFrozen: false,
        hadFreeze: true,
        loading: true,
      }),
    ).toBe(false);
  });

  it("keeps same-tab refresh on the live dest cache instead of dest-loading", () => {
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/plan",
        heldTab: "/plan",
        destIsTabRoot: true,
        hasDestCache: true,
        pathTab: "/plan",
        outletStale: false,
      }),
    ).toBe("dest");
    expect(
      isOutletStale({
        awaitHref: null,
        pathTab: "/plan",
        destTab: "/plan",
        childrenFrozen: false,
      }),
    ).toBe(false);
  });
});
