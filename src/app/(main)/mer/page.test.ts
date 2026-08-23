import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("Mer HIGH regress", () => {
  it("keeps Logga ut in Mer", () => {
    expect(src).toContain("SignOutButton");
    expect(src).toContain("Konto");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(src).toContain("numa-page-wide");
  });
});
