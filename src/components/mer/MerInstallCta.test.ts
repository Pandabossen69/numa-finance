import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MerInstallCta.tsx", import.meta.url), "utf8");
const mer = readFileSync(new URL("./MerScreen.tsx", import.meta.url), "utf8");

describe("Mer install CTA", () => {
  it("states the commercial install path in calm Swedish", () => {
    expect(src).toContain("Installera NUMA som app");
    expect(src).toContain("Öppna från hemskärmen, som en vanlig app");
    expect(src).toContain("Dela → Lägg till på hemskärmen");
    expect(src).toContain("NUMA är en app här");
    expect(src).toContain("Du öppnar den från hemskärmen. Inget mer behövs.");
  });

  it("uses existing standalone detection — no beforeinstallprompt or visit nag", () => {
    expect(src).toContain("isStandaloneDisplay");
    expect(src).not.toContain("beforeinstallprompt");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("DISMISS");
    expect(src).not.toContain("position: \"fixed\"");
    expect(src).not.toContain("aria-modal");
  });

  it("keeps the production-host button at a 44px tap target", () => {
    expect(src).toContain("inline-flex min-h-11 items-center justify-center");
    expect(src).toContain("Öppna {PRODUCTION_HOST}");
  });

  it("sits on Mer as an in-flow section, not a Hem overlay", () => {
    expect(mer).toContain("MerInstallCta");
    expect(mer).toContain("Som app");
    expect(mer).not.toContain("HomescreenInstallHint");
    expect(mer).not.toContain("md:hidden");
    expect(mer).not.toContain("På telefonen (alla konton)");
  });
});
