import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./HomescreenInstallHint.tsx", import.meta.url),
  "utf8",
);

describe("HomescreenInstallHint bar", () => {
  it("is a one-line dismissible bar, not the tall Hem card", () => {
    expect(src).toContain('variant?: "card" | "compact" | "bar"');
    expect(src).toContain("Hemskärmen ·");
    expect(src).toContain("Dölj hemskärmstips");
    expect(src).toContain("Lägg NUMA på hemskärmen");
  });
});
