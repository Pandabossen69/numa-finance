import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./HomescreenInstallHint.tsx", import.meta.url),
  "utf8",
);

describe("HomescreenInstallHint bar", () => {
  it("is a one-line dismissible bar, not the tall Hem card", () => {
    expect(src).toContain('variant?: "card" | "compact" | "bar"');
    expect(src).toContain("Hemskärmen ·");
    expect(src).toContain("Dölj hemskärmstips");
    expect(src).toContain("Lägg NUMA på hemskärmen");
  });

  it("delays the Hem bar so it does not steal the hero fold on cold open", () => {
    expect(src).toContain("HOMESCREEN_BAR_DELAY_MS");
    expect(src).toContain("1800");
    expect(src).toContain("setBarReady");
  });

  it("keeps Öppna and Stäng at a 44px tap target", () => {
    expect(src).toContain("flex min-h-11 min-w-0 items-center");
    expect(src).toContain(
      "inline-flex min-h-11 shrink-0 items-center px-2 text-[12px] font-semibold",
    );
    expect(src).toContain(
      "inline-flex min-h-11 shrink-0 items-center px-2 text-[12px] font-medium",
    );
  });

  it("gives the card dismiss a 44px tap target", () => {
    expect(src).toContain("numa-tap");
  });
});
