import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const loading = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");

describe("/importera Fortsätt", () => {
  it("resumes the pending observation instead of bare /fota", () => {
    expect(src).toContain("fotaHrefForObservation(o)");
    expect(src.match(/href=["']\/fota["']/g)).toEqual([
      'href="/fota"',
    ]);
  });

  it("uses card-shaped list skeletons instead of a tall grey column", () => {
    expect(loading).toContain("numa-panel-list");
    expect(loading).toContain("ImporteraRowSkel");
    expect(loading).not.toMatch(/numa-skel h-\[1[0-9]{2}/);
  });
});
