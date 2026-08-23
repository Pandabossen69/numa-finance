import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("../installningar/page.tsx", import.meta.url),
  "utf8",
);

describe("Mer HIGH regress", () => {
  it("keeps Logga ut in Mer", () => {
    expect(src).toContain("SignOutButton");
    expect(src).toContain("Konto");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(src).toContain("numa-page-wide");
  });

  it("keeps SignOut on Mer and not on Inställningar", () => {
    expect(src).toContain("SignOutButton");
    expect(settings).not.toContain("SignOutButton");
  });
});
