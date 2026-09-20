import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const client = readFileSync(
  new URL("../../../components/capture/FotaRouteClient.tsx", import.meta.url),
  "utf8",
);
const screen = readFileSync(
  new URL("../../../components/capture/FotaScreen.tsx", import.meta.url),
  "utf8",
);

describe("/fota resume", () => {
  it("loads the pending observation into the capture flow after paint", () => {
    expect(src).toContain("FotaRouteClient");
    expect(src).not.toContain("loadCaptureResume");
    expect(src).not.toMatch(/from ["']@\/features\/finance\/load-home["']/);
    expect(client).toContain("observation");
    expect(client).toContain("getCaptureResumeAction");
    expect(client).toContain("initialPreview");
    expect(client).toContain("if (!observationId) return");
    expect(screen).toContain("obs:${observationId}");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(screen).toContain("numa-page-wide");
    expect(screen).toContain("overflow-x-hidden");
  });

  it("paints last-known Fota the same tick — no RSC / Suspense wait", () => {
    expect(src).toContain("FotaRouteClient");
    expect(src).not.toContain("Suspense");
    expect(src).not.toContain("FotaFromParams");
    expect(src).not.toContain("await searchParams");
    expect(client).toContain("FotaScreen");
    expect(client).toContain("data={null}");
    expect(client).toContain("lastFotaIntent");
    expect(client).not.toContain("getHomeSnapshotAction");
  });
});
