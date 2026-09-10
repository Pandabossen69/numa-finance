import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/laga page", () => {
  it("does not auto-clear cache on load, and surfaces frozen home-screen hosts", () => {
    expect(src).toContain("Laga appen nu");
    expect(src).toContain("Ja, rensa cache");
    expect(src).toContain("Öppna production (rätt länk)");
    expect(src).toContain("Öppna Mer-menyn här");
    expect(src).toContain("Öppna Hem här");
    expect(src).toContain("isFrozenHomescreenHost");
    expect(src).toContain("Appen körs på:");
    expect(src).toContain('nextLagaPhase(current, "ask")');
    expect(src).toContain("clearNumaRuntimeCache");
  });
});
