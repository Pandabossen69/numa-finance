import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./FotaRouteClient.tsx", import.meta.url), "utf8");
const keepAlive = readFileSync(
  new URL("../layout/TabKeepAlive.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/(main)/fota/page.tsx", import.meta.url),
  "utf8",
);

describe("FotaRouteClient", () => {
  it("paints last-known FotaScreen the same tick and never awaits home RSC", () => {
    expect(src).toContain("<FotaScreen");
    expect(src).toContain("data={null}");
    expect(src).toContain("lastFotaIntent");
    expect(src).toContain("subscribeFotaIntent");
    expect(src).toContain("rememberFotaIntentFromHref");
    expect(src).toContain("getCaptureResumeAction");
    expect(src).toContain("if (!intent.observationId)");
    expect(src).not.toMatch(/from ["']@\/features\/finance\/load-home["']/);
    expect(src).not.toContain("getHomeSnapshotAction");
    expect(src).not.toContain("getCachedTodaySnapshot");
    expect(keepAlive).toContain('"/fota": <FotaRouteClient />');
    expect(page).toContain("FotaRouteClient");
    expect(page).not.toContain("Suspense");
  });
});
