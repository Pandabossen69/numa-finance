import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./QuickAddForms.tsx", import.meta.url), "utf8");

describe("Flytta/Kontant empty copy", () => {
  it("uses the Mer → Saldo path, not Mina saldon", () => {
    expect(src).toContain("SV.merPathSaldo");
    expect(src).not.toMatch(/Mina saldon/);
  });
});
