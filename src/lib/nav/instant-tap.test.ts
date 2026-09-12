import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { destChildrenArrived } from "@/components/layout/nav-await";
import { holdKey, isHoldRoot } from "@/components/layout/nav";
import { resolveVisibleTab } from "@/components/layout/view-hold";

const INSTANT = [
  "/idag",
  "/plan",
  "/analys",
  "/mer",
  "/transaktioner",
  "/konton",
  "/fota",
] as const;

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("instant tap — phone-width dest paint", () => {
  it("holds every main step as its own dest, including Konton and Transaktioner", () => {
    for (const href of INSTANT) {
      expect(holdKey(href), href).toBe(href);
      expect(isHoldRoot(href), href).toBe(true);
    }
    expect(isHoldRoot("/konton/ny")).toBe(false);
  });

  it("paints dest cache or dest-loading on rapid Hem↔Plan↔Analys↔Mer taps", () => {
    const taps = [
      { dest: "/plan", from: "/idag" },
      { dest: "/analys", from: "/plan" },
      { dest: "/mer", from: "/analys" },
      { dest: "/idag", from: "/mer" },
      { dest: "/plan", from: "/idag" },
      { dest: "/analys", from: "/plan" },
    ] as const;
    for (const tap of taps) {
      const first = resolveVisibleTab({
        loading: false,
        leaving: true,
        destTab: tap.dest,
        heldTab: tap.from,
        destIsTabRoot: true,
        hasDestCache: false,
        intentMismatch: true,
        pathTab: tap.from,
      });
      expect(first, `${tap.from}→${tap.dest} first`).toBe("dest-loading");
      const revisit = resolveVisibleTab({
        loading: false,
        leaving: true,
        destTab: tap.dest,
        heldTab: tap.from,
        destIsTabRoot: true,
        hasDestCache: true,
        intentMismatch: true,
        pathTab: tap.from,
      });
      expect(revisit, `${tap.from}→${tap.dest} revisit`).toBe("dest");
    }
  });

  it("does not release the dest shell when Next only delivered loading.tsx", () => {
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

  it("persists last-known Hem so a cold open paints without RSC", () => {
    const persist = read("../../features/home/last-snapshot-persist.ts");
    const last = read("../../features/home/last-snapshot.ts");
    const cookie = read("../../features/home/last-home-cookie.ts");
    const idag = read("../../app/(main)/idag/page.tsx");
    const hemClient = read("../../components/home/HemRouteClient.tsx");
    expect(persist).toContain("numa.lastKnown.v1");
    expect(last).toContain("hydrateLastKnownFromPersist");
    expect(last).toContain("writePersistedLastKnown");
    expect(last).toContain("clearPersistedLastKnown");
    expect(cookie).toContain("numa.lastHome.v1");
    expect(idag).toContain("HemRouteClient");
    // Provisional cookie SSR shell (Christian-bar) — not live confirm (#107).
    expect(idag).toContain("readLastHomeCookie");
    expect(idag).toContain("cookieShell");
    expect(idag).not.toContain("HomeViewLoading");
    expect(hemClient).toContain("HemFirstPaint");
    expect(hemClient).toContain("lastSessionHomeSnapshot");
    expect(hemClient).toContain("seedHomeLoginShell");
    expect(hemClient).not.toContain("readLastHomeCookie");
  });

  it("does not sleep JWT iat on the menu fetch path", () => {
    const jwt = read("../supabase/jwt-issued-at.ts");
    const fetchFn = jwt.slice(jwt.indexOf("export async function fetchWithJwtIssuedAtRetry"));
    expect(fetchFn).not.toContain("waitSharedJwtIssuedAt");
    expect(fetchFn).not.toContain("setTimeout");
  });

  it("marks Mer list dests so Konton and Transaktioner paint on pointerdown", () => {
    const mer = read("../../components/mer/MerHub.tsx");
    expect(mer).toContain("markIntent");
    expect(mer).toContain("isHoldRoot(href)");
    expect(mer).toContain("prefetch={false}");
  });

  it("marks Analys → Transaktioner so LastViewOutlet paints Rörelser, not loading.tsx", () => {
    const analys = read("../../components/analys/AnalysDashboard.tsx");
    expect(analys).toContain('href="/transaktioner"');
    expect(analys).toContain("markIntent(\"/transaktioner\")");
    expect(analys).toContain("prefetch={false}");
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/transaktioner",
        heldTab: "/analys",
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/transaktioner",
      }),
    ).toBe("dest-loading");
  });
});
