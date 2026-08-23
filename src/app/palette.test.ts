import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match?.[1], `missing ${name}`).toBeTruthy();
  return match![1].trim();
}

describe("NUMA vision palette", () => {
  it("keeps over-budget clay alarm distinct from destroy red", () => {
    expect(token("--numa-alarm")).toBe("#a86b3a");
    expect(token("--numa-danger")).toBe("#b42318");
    expect(token("--numa-alarm")).not.toBe(token("--numa-danger"));
  });

  it("defines shell bottom padding from nav, FAB overhang, and safe-area", () => {
    expect(css).toContain("--numa-nav-bar");
    expect(css).toContain("--numa-fab-overhang");
    expect(css).toContain("--numa-safe-bottom");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-nav-bar)");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-fab-overhang)");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-safe-bottom)");
  });
});
