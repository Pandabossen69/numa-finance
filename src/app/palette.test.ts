import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`(?:^|[\\s{;])${name}:\\s*([^;]+);`, "m"));
  expect(match?.[1], `missing ${name}`).toBeTruthy();
  return match![1].trim();
}

describe("NUMA vision palette", () => {
  it("keeps the canvas limestone, never paper white", () => {
    expect(token("--numa-bg")).toBe("#eee9e0");
    expect(token("--numa-surface-strong")).not.toBe("#ffffff");
    expect(token("--numa-surface-solid")).not.toBe("#ffffff");
    expect(token("--numa-card")).toBe("#fcfbf7");
    expect(css).not.toMatch(/linear-gradient\(\s*165deg,\s*#ffffff/);
    expect(css).not.toContain("#f7fcf9");
    expect(css).not.toContain("#c8d6ce");
  });

  it("tints living, park and income/spend as separate families", () => {
    expect(token("--numa-spend")).toBe("#8a5844");
    expect(token("--numa-spend")).not.toBe(token("--numa-alarm"));
    expect(token("--numa-spend")).not.toBe(token("--numa-danger"));
    expect(css).toContain(".numa-panel-strong");
    expect(css).toContain(".numa-panel-park");
    expect(css).toContain(".numa-amt-in");
    expect(css).toContain(".numa-amt-out");
    expect(css).toContain(".numa-wealth-cell.is-live");
    expect(css).toContain(".numa-piles-board");
    expect(css).toContain(".numa-day-metrics");
    expect(css).not.toContain("rgba(255, 255, 255, 0.75)");
    expect(token("--numa-accent")).toBe("#127a62");
  });

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

  it("keeps the Hem/Plan split rule at 1px so it cannot cover the right amount", () => {
    expect(css).toContain(".numa-split > div:not(.numa-split-rule)");
    expect(css).toContain(".numa-split-rule {");
    const rule = css.slice(
      css.indexOf(".numa-split-rule {"),
      css.indexOf("@keyframes numa-rise"),
    );
    expect(rule).toContain("width: 1px");
    expect(rule).toContain("max-width: 1px");
    expect(rule).toContain("padding: 0");
    expect(rule).not.toContain("padding: 0.85rem");
  });

  it("locks Plan money to a unit column so THB lines up", () => {
    expect(css).toContain("--numa-money-unit");
    expect(css).toContain(".numa-money.is-end");
    expect(css).toContain(".numa-plan-list");
    expect(css).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(8.6rem, auto) 2.75rem",
    );
    expect(css).toContain(".numa-plan-name");
    expect(css).toContain(".numa-plan-meta");
    expect(css).toContain(".numa-metric-value");
    expect(css).not.toMatch(/\.numa-metric-value \{[^}]*overflow: hidden/);
  });

  it("gives Hem a living wash login does not use", () => {
    expect(css).toContain(".numa-day-stage");
    expect(css).toContain("var(--numa-accent-glow)");
    expect(css).toContain("var(--numa-sun)");
    expect(css).toContain(".auth-mark::after");
  });

  it("keeps cards round and cream so numbers sit on a clear sheet", () => {
    expect(token("--numa-radius")).toBe("1.85rem");
    expect(token("--numa-radius-sm")).toBe("1.4rem");
    expect(css).toContain("border-radius: var(--numa-radius)");
    expect(css).toContain(".numa-money-unit");
    expect(css).toContain("font-variant-numeric: tabular-nums");
  });
});
