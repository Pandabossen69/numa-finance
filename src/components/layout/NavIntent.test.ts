import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./NavIntent.tsx", import.meta.url), "utf8");

describe("NavIntent", () => {
  it("keeps last intent after the URL matches dest until dest children arrive", () => {
    expect(src).toContain("intent");
    expect(src).toContain("clearIntent");
    expect(src).toContain("setIntent(next)");
    expect(src).toContain("optimisticNavPath(");
    expect(src).toContain("resolvedPending ?? intent");
    expect(src).not.toContain("setAwaitingHref");
  });

  it("exposes SPA keep-alive navigation for primary tabs", () => {
    expect(src).toContain("spaActive");
    expect(src).toContain("navigateSpaTab");
    expect(src).toContain("isSpaTabHref");
    expect(src).toContain("window.history.pushState");
    expect(src).toContain("setSpaPath");
  });

  it("intercepts in-app SPA tab links so App Router soft-nav never starts", () => {
    expect(src).toContain('document.addEventListener("pointerdown", onPointerDown, true)');
    expect(src).toContain('document.addEventListener("click", onClick, true)');
    expect(src).toContain("spaHrefFromAnchor");
    expect(src).toContain("event.preventDefault()");
    expect(src).toContain("event.stopPropagation()");
    expect(src).toContain("event.stopImmediatePropagation()");
    expect(src).toContain("navigateRef.current(href)");
  });

  it("paints SPA panels in the same tick via hidden + visibility, never display:none", () => {
    const paint = src.slice(
      src.indexOf("function paintSpaPanelsNow"),
      src.indexOf("function spaHrefFromAnchor"),
    );
    expect(paint).toContain('el.toggleAttribute("hidden"');
    expect(paint).toContain('el.classList.remove("numa-view-park")');
    expect(paint).toContain('el.setAttribute("data-numa-spa-visible"');
    expect(paint).not.toContain("setTimeout");
    expect(paint).not.toContain("queueMicrotask");
    expect(paint).not.toContain("requestAnimationFrame");
  });
});
