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
    expect(chip).toContain("font-size: 0.625rem");
    expect(chip).toContain("font-weight: 650");
    expect(chip).toContain("letter-spacing: 0.08em");
    expect(chip).toContain("height: 1.4rem");
    expect(chip).toContain("min-height: 1.4rem");
    expect(chip).toContain("max-height: 1.4rem");
  });

  it("locks button chips to the same type as span chips", () => {
    const chipType = css.slice(
      css.indexOf("button.numa-chip,"),
      css.indexOf("button.numa-chip:disabled"),
    );
    expect(chipType).not.toContain("font: inherit");
    expect(chipType).not.toContain("letter-spacing: inherit");
    expect(chipType).not.toContain("text-transform: inherit");
    expect(chipType).toContain("span.numa-chip");
    expect(chipType).toContain("p.numa-chip");
    expect(chipType).toContain("font-size: 0.625rem");
    expect(chipType).toContain("font-weight: 650");
    expect(chipType).toContain("letter-spacing: 0.08em");
    expect(chipType).toContain("text-transform: uppercase");
    expect(chipType).toContain("line-height: 1");
    const planChip = css.slice(
      css.indexOf(".numa-plan-figures .numa-chip {"),
      css.indexOf(".numa-plan-menu"),
    );
    expect(planChip).toContain("min-width: 4.75rem");
    expect(planChip).toContain("font-size: 0.625rem");
    expect(planChip).toContain("height: 1.4rem");
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
    expect(css).toContain("--numa-safe-left");
    expect(css).toContain("--numa-safe-right");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-nav-bar)");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-fab-overhang)");
    expect(token("--numa-shell-pad-bottom")).toContain("var(--numa-safe-bottom)");
  });

  it("locks chrome tap targets at 44px and clips horizontal overflow", () => {
    expect(token("--numa-touch")).toBe("2.75rem");
    const monthChip = css.slice(
      css.indexOf(".numa-month-chip {"),
      css.indexOf(".numa-month-dots {"),
    );
    expect(monthChip).toContain("min-height: var(--numa-touch)");
    expect(css).toContain(".numa-scope-chip {");
    expect(css).toContain(".numa-bottom-nav {");
    expect(css).toContain("padding-left: var(--numa-safe-left)");
    expect(css).toContain("padding-bottom: var(--numa-safe-bottom)");
    expect(css).toMatch(/html \{[^}]*overflow-x:\s*clip/);
    expect(css).toMatch(/body \{[^}]*overflow-x:\s*clip/);
    expect(css).toContain(".numa-page {");
    expect(css).toMatch(/\.numa-page \{[^}]*overflow-x:\s*clip/);
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
    expect(css).toContain("white-space: nowrap");
    expect(css).toContain("min-width: min-content");
    expect(css).toContain("lining-nums");
    expect(css).toContain('"tnum" 1');
    expect(css).toContain('"lnum" 1');
    expect(css).toContain(".numa-pile-line {");
    expect(css).toContain(".numa-pile-line .money.numa-money-amt");
    expect(css).toContain("font-size: 0.9375rem");
    expect(css).toContain("overflow-wrap: break-word");
    expect(css).not.toContain("overflow-wrap: anywhere");
    expect(css).not.toContain(
      "grid-template-columns: minmax(0, 1fr) var(--numa-money-unit)",
    );
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
    expect(css).toContain("font-variant-numeric: tabular-nums lining-nums");
    expect(css).toContain(".numa-piles-board {");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    const wealth = css.slice(
      css.indexOf(".numa-wealth-score {"),
      css.indexOf(".numa-amt-in"),
    );
    expect(wealth).toContain("flex-direction: column");
    expect(wealth).toContain("flex-wrap: nowrap");
    expect(wealth).toContain(".numa-wealth-value");
    expect(wealth).toContain("@media (min-width: 1024px)");
    expect(wealth).not.toContain("flex: 1 1");
    expect(wealth).not.toContain("flex-wrap: wrap");
    expect(css).toContain(".numa-money-groups");
    expect(css).toContain("flex-wrap: nowrap");
    expect(css).toContain("column-gap: 0.2em");
    expect(css).toContain("font-synthesis: none");
    expect(css).toContain("letter-spacing: 0");
    expect(css).not.toContain("flex: 1 1 5.5rem");
    expect(css).not.toContain(".numa-money-sep");
  });

  it("locks remaining-screen chips equal and money on one line", () => {
    const chips = css.slice(
      css.indexOf(".numa-equal-chips {"),
      css.indexOf(".numa-chip-scroll {"),
    );
    expect(chips).toContain("repeat(2, minmax(0, 1fr))");
    expect(chips).toContain("white-space: nowrap");
    expect(chips).toContain(".numa-equal-chips.is-quad");

    const trio = css.slice(
      css.indexOf(".numa-stat-trio {"),
      css.indexOf(".numa-money-line {"),
    );
    expect(trio).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(trio).toContain("repeat(3, minmax(0, 1fr))");

    const moneyLine = css.slice(
      css.indexOf(".numa-money-line {"),
      css.indexOf(".numa-hero-money {"),
    );
    expect(moneyLine).toContain("white-space: nowrap");
    expect(moneyLine).toContain("flex-shrink: 0");

    const wealth = css.slice(
      css.indexOf(".numa-analys-wealth .numa-wealth-score {"),
      css.indexOf(".numa-status-chip {"),
    );
    expect(wealth).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(wealth).toContain(".numa-wealth-op");
    expect(wealth).toContain("display: none");

    const tap = css.slice(
      css.indexOf(".numa-tap {"),
      css.indexOf(".auth-card {"),
    );
    expect(tap).toContain("min-height: 2.75rem");
    expect(tap).toContain(".numa-tap-icon");
  });
});
