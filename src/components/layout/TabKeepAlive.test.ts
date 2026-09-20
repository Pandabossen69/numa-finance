import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./TabKeepAlive.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

describe("TabKeepAlive", () => {
  it("mounts SPA panels once and parks RSC children while a tab is active", () => {
    expect(src).toContain("useNavIntent");
    expect(src).toContain("spaTabKey");
    expect(src).toContain("SPA_TAB_HREFS");
    expect(src).toContain("hidden={!visible}");
    expect(src).toContain("SPA_TAB_HREFS.map");
    expect(src).toContain("useState");
    expect(src).toContain("panelBodies");
    expect(src).not.toMatch(/mounted.*useState/);
    // Park class is display:none and must not wrap SPA panels.
    expect(src).not.toMatch(/data-numa-spa-tab[\s\S]*numa-view-park/);
    expect(src).not.toMatch(
      /className=\{visible \? undefined : "numa-view-park"\}/,
    );
    expect(src).toContain("data-numa-rsc-shadow");
    expect(src).toContain("if (!active)");
    expect(src).toContain("{children}");
  });

  it("is wired under AppShell around LastViewOutlet", () => {
    expect(shell).toContain('import { TabKeepAlive } from "@/components/layout/TabKeepAlive"');
    expect(shell).toContain("homeCookieShell");
    expect(shell).toContain("<TabKeepAlive homeCookieShell={homeCookieShell}>");
    expect(shell).toContain("</TabKeepAlive>");
  });

  it("SSR-seeds the visible Hem panel from the last-home cookie (SPEC 6b)", () => {
    expect(src).toContain("homeCookieShell");
    expect(src).toContain("cookieShell={homeCookieShell}");
    expect(src).toContain("<HemRouteClient cookieShell={homeCookieShell} />");
  });

  it("mounts Fota as a keep-alive panel so dest chrome is not in the RSC shadow", () => {
    expect(src).toContain("FotaRouteClient");
    expect(src).toContain('"/fota": <FotaRouteClient />');
    expect(src).toContain("data-numa-rsc-shadow");
  });
});