import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/laga page", () => {
  it("frames the action as an update, without homescreen install tips", () => {
    expect(src).toContain("Uppdatera appen");
    expect(src).toContain("Uppdatera nu");
    expect(src).toContain("Hämtar senaste versionen");
    expect(src).toContain("Dina konton påverkas inte");
    expect(src).toContain("Tillbaka till Hem");
    expect(src).toContain("isFrozenHomescreenHost");
    expect(src).toContain('nextLagaPhase(current, "ask")');
    expect(src).toContain("clearNumaRuntimeCache");
    expect(src).toContain("navigateAfterRepair");
    expect(src).toContain("BRAND_MARK");
    expect(src).not.toContain("location.replace");
    expect(src).not.toContain("unregister");

    expect(src).not.toContain("Laga appen");
    expect(src).not.toContain("Ja, rensa cache");
    expect(src).not.toContain("lägg till NUMA på hemskärmen");
    expect(src).not.toContain("tillfälliga Vercel");
    expect(src).not.toContain("Öppna production (rätt länk)");
    expect(src).not.toContain("Öppna Mer-menyn här");
  });
});
