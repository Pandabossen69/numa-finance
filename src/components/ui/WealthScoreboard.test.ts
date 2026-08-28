import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./WealthScoreboard.tsx", import.meta.url), "utf8");

describe("CompactPiles cash stack", () => {
  it("shows Saldo as the Hem pile and Över in the breakdown, not Mot planen", () => {
    const compact = src.slice(src.indexOf("export function CompactPiles"));
    expect(compact).toContain("SV.saldo");
    expect(compact).toContain("SV.kommerIn");
    expect(compact).toContain('tone="in"');
    expect(compact).toContain('tone="out"');
    expect(compact).toContain("SV.kvarAttBetala");
    expect(compact).toContain("SV.over");
    expect(compact).toContain("numa-piles-board");
    expect(compact).toContain("numa-pile-stack");
    expect(compact).toContain("<PileLine");
    expect(compact).toContain("is-live");
    expect(compact).toContain("is-park");
    expect(compact).not.toContain("numa-panel-strong");
    expect(compact).not.toContain("numa-panel-park");
    expect(compact).not.toContain("Mer än planerat.");
    expect(compact).not.toContain("SV.motPlanen");
    expect(compact).not.toContain('size="xs"');
    expect(compact).not.toContain("text-[11px]");
  });
});

describe("WealthScoreboard Analys leftover", () => {
  it("defaults the leftover cell to Mot planen so Analys can keep vs-plan math", () => {
    expect(src).toContain("livingLabel = SV.motPlanen");
    expect(src).toContain("numa-wealth-cell");
    expect(src).toContain(
      'livingOk ? "text-[var(--numa-positive)]" : "text-[var(--numa-alarm)]"',
    );
  });
});
