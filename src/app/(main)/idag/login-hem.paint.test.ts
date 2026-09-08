import { createElement, Suspense } from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HemPending } from "@/components/layout/ViewLoading";
import {
  isViewLoadingNode,
  resolveVisibleTab,
} from "@/components/layout/view-hold";

const idag = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const outlet = readFileSync(
  new URL("../../../components/layout/LastViewOutlet.tsx", import.meta.url),
  "utf8",
);
const hold = readFileSync(
  new URL("../../../components/layout/view-hold.ts", import.meta.url),
  "utf8",
);

/**
 * After login, last-known is wiped and /idag is:
 *   <Suspense fallback={<HemFirstPaint />}><IdagBody /></Suspense>
 * That tree must be live children so the snapshot can paint without a
 * tab remount. Treating Suspense as loading left dest-loading empty.
 */
describe("login → Hem first mount", () => {
  it("does not treat the Hem page Suspense as a loading slot", () => {
    const page = createElement(
      Suspense,
      { fallback: createElement(HemPending) },
      createElement("div", { "data-hem-body": "true" }, "IdagBody"),
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

  it("keeps IdagBody inside Suspense and mounts hidden live children on dest-loading", () => {
    expect(idag).toContain("<Suspense fallback={<HemFirstPaint />}>");
    expect(idag).toContain("IdagBody");
    expect(hold).not.toContain("if (node.type === Suspense) return true;");
    expect(outlet).toContain("data-numa-hidden-live");
  });
});
