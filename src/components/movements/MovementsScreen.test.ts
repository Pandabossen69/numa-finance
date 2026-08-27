import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./MovementsScreen.tsx", import.meta.url), "utf8");

describe("Rörelser expense color", () => {
  it("paints Utgifter and negative Netto in clay alarm", () => {
    expect(src).toContain('label="Utgifter"');
    expect(src).toContain('tone="alarm"');
    expect(src).toContain('tone={net >= 0 ? "positive" : "alarm"}');
    expect(src).not.toMatch(/label="Utgifter"[\s\S]{0,80}tone="danger"/);
  });

  it("asks for an in-DOM confirm before Ta bort", () => {
    expect(src).toContain("confirmId");
    expect(src).toContain("setConfirmId(tx.id)");
    expect(src).not.toContain("window.confirm");
    expect(src).toContain('event.key === "Escape"');
    expect(src).toContain("confirmId == null || confirmId === tx.id");
  });

  it("formats edit amounts with a Swedish comma", () => {
    expect(src).toContain("minorToUiAmount");
    expect(src).not.toContain("toFixed(2)");
  });

  it("gives Rörelser chips a 44px tap target", () => {
    expect(src).toContain("min-h-11 rounded-full");
    expect(src).not.toContain("min-h-10 rounded-full");
  });
});
