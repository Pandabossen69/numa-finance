import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

const src = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("sw.js", () => {
  it("stamps a build id and skipWaiting without caching HTML", () => {
    expect(src).toContain("numa-sw ${BUILD_ID}");
    expect(src).toContain("skipWaiting");
    expect(src).toContain("caches.delete");
    expect(src).toContain("SKIP_WAITING");
    expect(src).toContain('path.startsWith("/_next/static/")');
    expect(src).toContain("isRscOrDocument");
    expect(src).toContain('request.mode === "navigate"');
    expect(src).toContain("_rsc");
    expect(src).toContain("Next-Router-Prefetch");
    expect(src).not.toContain("cache.put(event.request");
  });

  it("serves javascript with a no-store cache header", async () => {
    const res = GET();
    expect(res.headers.get("Content-Type")).toMatch(/javascript/);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    const body = await res.text();
    expect(body).toContain("numa-sw");
    expect(body).toContain("skipWaiting");
    expect(body).toContain("numa-static-");
    expect(body).toContain("/_next/static/");
    expect(body).toContain('request.mode === "navigate"');
    expect(body).not.toContain("event.respondWith(caches.match(event.request)");
  });
});
