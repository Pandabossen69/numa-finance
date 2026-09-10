import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./BottomNav.tsx", import.meta.url), "utf8");

describe("BottomNav a11y", () => {
  it("marks the active tab as the current page and keeps icon-only labels in aria", () => {
    expect(src).toContain('aria-current={active ? "page" : undefined}');
    expect(src).toContain("aria-busy={pending || undefined}");
    expect(src).toContain("aria-label={label}");
    expect(src).toContain('aria-label="Lägg till"');
    expect(src).toContain("is-pending");
    expect(src).toContain("is-active");
  });

  it("uses an edge icon dock with a symmetrical center + and no caption clutter", () => {
    expect(src).toContain("numa-bottom-nav");
    expect(src).toContain("numa-fab");
    expect(src).toContain("min-h-[var(--numa-touch)]");
    expect(src).toContain("grid-cols-5");
    expect(src).toContain("strokeWidth");
    expect(src).not.toContain("Lägg till</span>");
    expect(src).not.toMatch(/>\s*\{label\}\s*</);
    expect(src).not.toContain("-mt-7");
    expect(src).not.toContain("bg-[var(--numa-accent-soft)]");
    expect(src).not.toContain("text-[10px]");
    expect(src).not.toContain("h-12 w-12");
  });
});
