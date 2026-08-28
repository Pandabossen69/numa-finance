import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./BottomNav.tsx", import.meta.url), "utf8");

describe("BottomNav a11y", () => {
  it("marks the active tab as the current page", () => {
    expect(src).toContain('aria-current={active ? "page" : undefined}');
    expect(src).toContain("numa-accent-soft");
  });

  it("sits in the home-indicator safe area and keeps 44px tabs", () => {
    expect(src).toContain("numa-bottom-nav");
    expect(src).toContain("min-h-[3.5rem]");
    expect(src).toContain("h-14 w-14");
    expect(src).toContain("whitespace-nowrap");
    expect(src).not.toContain("paddingBottom");
  });
});
