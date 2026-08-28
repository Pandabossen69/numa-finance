import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./QuickAddForms.tsx", import.meta.url), "utf8");

describe("Flytta/Kontant empty copy", () => {
  it("uses the Mer → Saldo path, not Mina saldon", () => {
    expect(src).toContain("SV.merPathSaldo");
    expect(src).not.toMatch(/Mina saldon/);
  });

  it("keeps mode chips equal and category chips the same 44px size", () => {
    expect(src).toContain("numa-equal-chips is-quad");
    expect(src).toContain("numa-chip-scroll");
    expect(src).toContain("min-h-11");
    expect(src).not.toContain("min-h-10");
  });
});
