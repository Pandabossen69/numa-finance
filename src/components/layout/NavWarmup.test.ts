import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./NavWarmup.tsx", import.meta.url), "utf8");

describe("NavWarmup", () => {
  it("warms Hem, Plan and Analys so tab switches can paint dest shells", () => {
    expect(src).toContain("PRIMARY_NAV");
    expect(src).toContain("warmHrefs");
    expect(src).toContain("/transaktioner");
    expect(src).toContain("/fota");
  });
});
