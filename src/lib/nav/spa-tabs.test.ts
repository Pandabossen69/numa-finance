import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSpaTabHref, spaTabKey, SPA_TAB_HREFS } from "@/lib/nav/spa-tabs";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("SPA keep-alive primary tabs", () => {
  it("maps routes onto the five keep-alive panels", () => {
    expect(SPA_TAB_HREFS).toEqual([
      "/idag",
      "/plan",
      "/analys",
      "/mer",
      "/transaktioner",
    ]);
    expect(spaTabKey("/")).toBe("/idag");
    expect(spaTabKey("/idag")).toBe("/idag");
    expect(spaTabKey("/idag/extra")).toBe("/idag");
    expect(spaTabKey("/plan?steg=inkomst")).toBe("/plan");
    expect(spaTabKey("/plan/foo")).toBe("/plan");
    expect(spaTabKey("/analys")).toBe("/analys");
    expect(spaTabKey("/analys/x")).toBe("/analys");
    expect(spaTabKey("/mer")).toBe("/mer");
    expect(spaTabKey("/mer/extra")).toBeNull();
    expect(spaTabKey("/transaktioner")).toBe("/transaktioner");
    expect(spaTabKey("/transaktioner/1")).toBe("/transaktioner");
    expect(spaTabKey("/konton")).toBeNull();
    expect(spaTabKey("/fota")).toBeNull();
    expect(isSpaTabHref("/idag")).toBe(true);
    expect(isSpaTabHref("/konton")).toBe(false);
  });

  it("lets BottomNav and SideNav call navigateSpaTab and preventDefault", () => {
    const bottom = read("../../components/layout/BottomNav.tsx");
    const side = read("../../components/layout/SideNav.tsx");
    expect(bottom).toContain("navigateSpaTab");
    expect(bottom).toContain("event.preventDefault()");
    expect(bottom).toContain("if (navigateSpaTab(href))");
    expect(side).toContain("navigateSpaTab");
    expect(side).toContain("event.preventDefault()");
    expect(side).toContain("if (navigateSpaTab(href))");
  });

  it("does not let SideNav navigateSpaTab on mouse enter or hover", () => {
    const side = read("../../components/layout/SideNav.tsx");
    expect(side).not.toMatch(/onMouseEnter=\{[^}]*navigateSpaTab/);
    expect(side).not.toMatch(/onMouseEnter=\{\(\) => onIntent/);
    expect(side).toContain('prefetch={false}');
    const idagLink = side.slice(
      side.indexOf('href="/idag"'),
      side.indexOf("className=\"group block"),
    );
    expect(idagLink).toContain("prefetch={false}");
    expect(idagLink).not.toContain("onMouseEnter");
    expect(idagLink).not.toContain("navigateSpaTab");
  });

  it("skips cold fetch on Plan/Analys/Movements/Mer when last-known exists", () => {
    const plan = read("../../components/plan/PlanRouteClient.tsx");
    const analys = read("../../components/analys/AnalysRouteClient.tsx");
    const movements = read("../../components/movements/MovementsRouteClient.tsx");
    const mer = read("../../components/mer/MerRouteClient.tsx");
    expect(plan).toContain("if (lastPlanSnapshot()) return;");
    expect(analys).toContain("if (lastAnalysSnapshot()) return;");
    expect(movements).toContain("if (lastMovementsSnapshot()) return;");
    expect(mer).toContain("if (lastMerSnapshot()) return;");
  });

  it("wraps the shell outlet in TabKeepAlive with the five route clients", () => {
    const shell = read("../../components/layout/AppShell.tsx");
    const keepAlive = read("../../components/layout/TabKeepAlive.tsx");
    expect(shell).toContain("TabKeepAlive");
    expect(shell).toContain("<TabKeepAlive>");
    expect(shell).toContain("<LastViewOutlet>{children}</LastViewOutlet>");
    expect(keepAlive).toContain("HemRouteClient");
    expect(keepAlive).toContain("PlanRouteClient");
    expect(keepAlive).toContain("AnalysRouteClient");
    expect(keepAlive).toContain("MerRouteClient");
    expect(keepAlive).toContain("MovementsRouteClient");
    expect(keepAlive).toContain("data-numa-spa-tab");
    expect(keepAlive).toContain("spaTabKey");
  });

  it("keeps /idag and /mer pages as thin Hem/Mer route clients", () => {
    const idag = read("../../app/(main)/idag/page.tsx");
    const mer = read("../../app/(main)/mer/page.tsx");
    expect(idag).toContain("HemRouteClient");
    expect(idag).toMatch(/return\s+<\s*HemRouteClient\s*\/>/);
    expect(idag).not.toContain("IdagBody");
    expect(mer).toContain("MerRouteClient");
    expect(mer).toMatch(/return\s+<\s*MerRouteClient\s*\/>/);
    expect(mer).not.toContain("MerBody");
  });
});
