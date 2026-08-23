import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/importera Fortsätt", () => {
  it("resumes the pending observation instead of bare /fota", () => {
    expect(src).toContain("fotaHrefForObservation(o)");
    expect(src.match(/href=["']\/fota["']/g)).toEqual([
      'href="/fota"',
    ]);
  });
});
