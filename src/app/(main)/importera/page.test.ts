import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("../../../components/mer/ImporteraScreen.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/importera Fortsätt", () => {
  it("resumes the pending observation instead of bare /fota", () => {
    expect(src).toContain("fotaHrefForObservation(o)");
    expect(src.match(/href=["']\/fota["']/g)).toEqual([
      'href="/fota"',
    ]);
  });

  it("uses card-shaped list skeletons instead of a tall grey column", () => {
    expect(loading).toContain("ImporteraViewLoading");
    expect(loading).not.toMatch(/numa-skel h-\[1[0-9]{2}/);
  });

  it("keeps status chips one size and resume links 44px", () => {
    expect(src).toContain("numa-status-chip");
    expect(src).toContain("numa-money-line");
    expect(src).toContain("numa-tap");
    expect(src).toContain("overflow-x-hidden");
  });

  it("streams last-known pictures while observations load", () => {
    expect(page).toContain("Suspense");
    expect(page).toContain("ImporteraScreen");
    expect(src).toContain("lastImporteraRows");
    expect(src).toContain("fotaHrefForObservation(o)");
  });
});
