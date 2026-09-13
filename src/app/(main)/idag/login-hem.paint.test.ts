import { createElement, Suspense } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HemPending } from "@/components/layout/ViewLoading";
import { isViewLoadingNode, resolveVisibleTab } from "@/components/layout/view-hold";

const idag = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const hemClient = readFileSync(
  new URL("../../../components/home/HemRouteClient.tsx", import.meta.url),
  "utf8",
);
const outlet = readFileSync(
  new URL("../../../components/layout/LastViewOutlet.tsx", import.meta.url),
  "utf8",
);
const hold = readFileSync(
  new URL("../../../components/layout/view-hold.ts", import.meta.url),
  "utf8",
);
const keepAlive = readFileSync(
  new URL("../../../components/layout/TabKeepAlive.tsx", import.meta.url),
  "utf8",
);

/**
 * After login, last-known is wiped and /idag paints via HemRouteClient
 * under SPA keep-alive (last-known / HemFirstPaint, then quiet fetch).
 * Suspense-with-children must still not be treated as a loading slot so
 * any live RSC subtree can paint without a remount.
 */
describe("login → Hem first mount", () => {
  it("does not treat a Suspense-with-children tree as a loading slot", () => {
    const page = createElement(
      Suspense,
      { fallback: createElement(HemPending) },
      createElement("div", { "data-hem-body": "true" }, "HemRouteClient"),
    );
    expect(isViewLoadingNode(page)).toBe(false);
    expect(
      resolveVisibleTab({
        loading: isViewLoadingNode(page),
        leaving: false,
        destTab: "/idag",
        heldTab: null,
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/idag",
      }),
    ).toBe("children");
  });

  it("still treats a loading.tsx-only Suspense as loading", () => {
    const slot = createElement(Suspense, {
      fallback: createElement(HemPending),
    });
    expect(isViewLoadingNode(slot)).toBe(true);
    expect(
      resolveVisibleTab({
        loading: true,
        leaving: false,
        destTab: "/idag",
        heldTab: null,
        destIsTabRoot: true,
        hasDestCache: false,
        pathTab: "/idag",
      }),
    ).toBe("dest-loading");
  });

  it("keeps Hem client-first under keep-alive and mounts hidden live children on dest-loading", () => {
    expect(idag).toContain("HemRouteClient");
    expect(idag).not.toContain("<Suspense");
    expect(idag).not.toContain("IdagBody");
    expect(hemClient).toContain("HemFirstPaint");
    expect(hemClient).toContain("lastSessionHomeSnapshot");
    expect(hemClient).toContain("lastHomeSnapshot");
    expect(keepAlive).toContain("HemRouteClient");
    expect(keepAlive).toContain('"/idag": <HemRouteClient cookieShell={homeCookieShell} />');
    expect(keepAlive).toContain("data-numa-spa-tab");
    expect(hold).not.toContain("if (node.type === Suspense) return true;");
    expect(outlet).toContain("data-numa-hidden-live");
  });
});
