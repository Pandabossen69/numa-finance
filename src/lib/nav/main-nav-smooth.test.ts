import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStaleNavArrival, optimisticNavPath } from "@/components/layout/nav";
import { resolveVisibleTab, shouldHoldPreviousView } from "@/components/layout/view-hold";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("SMOOTH 01 root cause contracts", () => {
  it("keeps last intent even after a stale intermediate URL lands", () => {
    expect(
      optimisticNavPath("/analys", { href: "/plan", fromPath: "/idag" }),
    ).toBe("/plan");
    expect(
      isStaleNavArrival("/analys", { href: "/plan", fromPath: "/idag" }),
    ).toBe(true);
    expect(isStaleNavArrival("/plan", { href: "/plan", fromPath: "/idag" })).toBe(
      false,
    );
  });

  it("paints the dest shell on first visit instead of holding the previous tab", () => {
    expect(
      shouldHoldPreviousView({
        loading: true,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
      }),
    ).toBe(false);
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/analys",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: false,
      }),
    ).toBe("dest-loading");
  });

  it("ignores a stale RSC when the last tap is a different tab", () => {
    expect(
      resolveVisibleTab({
        loading: false,
        leaving: false,
        destTab: "/plan",
        heldTab: "/idag",
        destIsTabRoot: true,
        hasDestCache: false,
        intentMismatch: true,
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
        intentMismatch: true,
      }),
    ).toBe("dest");
  });

  it("streams Hem, Plan and Analys behind Suspense so the shell is not blocked", () => {
    const idag = read("../../app/(main)/idag/page.tsx");
    const plan = read("../../app/(main)/plan/page.tsx");
    const analys = read("../../app/(main)/analys/page.tsx");
    expect(idag).toContain("<Suspense");
    expect(idag).toContain("IdagBody");
    expect(plan).toContain("<Suspense");
    expect(plan).toContain("PlanBody");
    expect(analys).toContain("<Suspense");
    expect(analys).toContain("AnalysBody");
  });

  it("lets Hem/Plan/Analys/Rörelser SSR so dest content does not wait on a client chunk", () => {
    const islands = read("../route-islands.tsx");
    const home = islands.slice(
      islands.indexOf("export const HomeDashboard"),
      islands.indexOf("export const ReceiptCaptureFlow"),
    );
    expect(home).toContain("ssr: true");
    expect(home).not.toContain("ssr: false");
    const movements = islands.slice(
      islands.indexOf("export const MovementsScreen"),
      islands.indexOf("export const OnboardingSaldoChoice"),
    );
    expect(movements).toContain("ssr: true");
    expect(movements).not.toContain("ssr: false");
  });

  it("skips proxy getUser on RSC/prefetch so tab switches do not share a 2.5s Auth gate", () => {
    const middleware = read("../supabase/middleware.ts");
    expect(middleware).toContain("shouldSkipProxyGetUser");
    expect(middleware).toContain("isRscOrPrefetchRequest");
    expect(middleware).toContain("AUTH_TIMEOUT_MS = 2_500");
  });

  it("does not let Plan or Fota await searchParams before the Suspense shell", () => {
    const plan = read("../../app/(main)/plan/page.tsx");
    const fota = read("../../app/(main)/fota/page.tsx");
    const planBefore = plan.slice(0, plan.indexOf("<Suspense"));
    const fotaBefore = fota.slice(0, fota.indexOf("<Suspense"));
    expect(planBefore).not.toContain("await searchParams");
    expect(fotaBefore).not.toContain("await searchParams");
    expect(plan).toContain("PlanFromParams");
    expect(fota).toContain("FotaFromParams");
  });

  it("does not force full Link prefetch on the four main tabs", () => {
    const bottom = read("../../components/layout/BottomNav.tsx");
    const side = read("../../components/layout/SideNav.tsx");
    expect(bottom).toContain("prefetch={false}");
    expect(side).toContain("prefetch={false}");
  });

  it("keeps fail-closed proxy skip and retries JWT iat without sleeping", () => {
    const proxyAuth = read("../supabase/proxy-auth.ts");
    const jwt = read("../supabase/jwt-issued-at.ts");
    expect(proxyAuth).toContain("if (input.tokenExpiresAtMs == null) return false");
    expect(jwt).toContain("fetchWithJwtIssuedAtRetry");
    expect(jwt).toContain("initWithFetchMemoizationBypass");
    const fetchFn = jwt.slice(jwt.indexOf("export async function fetchWithJwtIssuedAtRetry"));
    expect(fetchFn).not.toContain("waitSharedJwtIssuedAt");
    expect(fetchFn).not.toContain("setTimeout");
  });
});
