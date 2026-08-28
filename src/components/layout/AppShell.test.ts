import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

describe("AppShell chrome", () => {
  it("insets Hem from notch, home indicator, and side safe-areas", () => {
    expect(src).toContain("overflow-x-clip");
    expect(src).toContain("pl-[max(1rem,var(--numa-safe-left))]");
    expect(src).toContain("pr-[max(1rem,var(--numa-safe-right))]");
    expect(src).toContain("pt-[max(0.95rem,var(--numa-safe-top))]");
    expect(src).toContain("pb-[var(--numa-shell-pad-bottom)]");
    expect(src).toContain("md:pb-16");
    expect(src).toContain("min-h-11");
  });

  it("does not keep the mobile nav pad on desktop", () => {
    expect(src).toContain("md:hidden");
    expect(src).toContain("<BottomNav />");
    expect(src).toContain("md:pb-16");
    expect(src).not.toContain("md:pb-[var(--numa-shell-pad-bottom)]");
  });
});
