import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/laga page", () => {
  it("frames the action as an update, then leaves for Hem", () => {
    expect(src).toContain("Uppdatera appen");
    expect(src).toContain("Uppdatera nu");
    expect(src).toContain("Öppna Hem");
    expect(src).toContain("Klar. Öppnar Hem…");
    expect(src).toContain("Tillbaka till Hem");
    expect(src).toContain("Hämtar senaste versionen");
    expect(src).toContain("Dina konton påverkas inte");
    expect(src).toContain('navigateAfterRepair("/idag")');
    expect(src).toContain("isFrozenHomescreenHost");
    expect(src).toContain("readFrozenHost");
    expect(src).toContain("readLagaHostSnapshot");
    expect(src).toContain("shouldAcceptRepairStart");
    expect(src).toContain("repairStartedRef");
    expect(src).toContain('nextLagaPhase(current, "ask")');
    expect(src).toContain("clearNumaRuntimeCache");
    expect(src).toContain("BRAND_MARK");

    // Object snapshots from useSyncExternalStore crash /laga (max update depth).
    expect(src).not.toMatch(/readHostInfo\s*\(/);
    expect(src).not.toContain("{ host, frozen");
    expect(src).not.toContain("reloadRepairSuccessPage");
    expect(src).not.toContain("location.replace");
    expect(src).not.toContain("unregister");
    expect(src).not.toContain("Laga appen");
    expect(src).not.toContain("Ja, rensa cache");
    expect(src).not.toContain("lägg till NUMA på hemskärmen");
    expect(src).not.toContain("tillfälliga Vercel");
    expect(src).not.toContain("Öppna production (rätt länk)");
    expect(src).not.toContain("Öppna Mer-menyn här");
  });

  it("keeps a manual Hem fallback after success and before confirm", () => {
    expect(src).toContain('href="/idag"');
    expect(src).toContain("phase === \"done\" && !frozenHost");
    expect(src).toContain("Tillbaka till Hem");
  });
});
