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

  it("fades the Plan month strip only on overflowing edges", () => {
    expect(css).toContain(".numa-month-strip");
    expect(css).toContain(".numa-month-strip.is-overflow-start.is-overflow-end");
    expect(css).toMatch(/mask-image:\s*linear-gradient/);
    expect(css).toContain("transparent 0");
    expect(css).toContain("transparent 100%");
    expect(css).toContain("#000 1.5rem");
  });

  it("uses one desktop content width for Hem, Plan, Analys, Mer and Fota", () => {
    expect(token("--numa-content-max")).toBe("58rem");
    expect(css).toContain(".numa-page,");
    expect(css).toContain(".numa-page-wide {");
    expect(css).toContain("max-width: var(--numa-content-max)");
  });

  it("keeps status chips on one line", () => {
    const chip = css.slice(css.indexOf(".numa-chip {"), css.indexOf(".numa-chip-mint"));
    expect(chip).toContain("white-space: nowrap");
    expect(chip).toContain("flex-shrink: 0");
  });

  it("keeps pile meters for overspend on clay, not destroy red", () => {
    const alarm = css.slice(
      css.indexOf(".numa-pile-meter > i.is-alarm"),
      css.indexOf(".numa-year-dots"),
    );
    expect(alarm).toContain("var(--numa-alarm)");
    expect(alarm).not.toContain("var(--numa-danger)");
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
