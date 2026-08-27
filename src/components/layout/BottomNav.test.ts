import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./BottomNav.tsx", import.meta.url), "utf8");

describe("BottomNav a11y", () => {
  it("marks the active tab as the current page", () => {
    expect(src).toContain('aria-current={active ? "page" : undefined}');
  });
});
