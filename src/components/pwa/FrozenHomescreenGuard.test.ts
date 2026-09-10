import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./FrozenHomescreenGuard.tsx", import.meta.url),
  "utf8",
);

describe("FrozenHomescreenGuard", () => {
  it("blocks standalone apps on preview hosts and tells users to reinstall", () => {
    expect(src).toContain("isStandaloneDisplay");
    expect(src).toContain("isFrozenHomescreenHost");
    expect(src).toContain("PRODUCTION_HOST");
    expect(src).toContain("Hemskärmsappen pekar fel");
    expect(src).toContain("Ta bort NUMA-ikonen från hemskärmen");
    expect(src).toContain("Öppna rätt länk i Safari");
  });
});
