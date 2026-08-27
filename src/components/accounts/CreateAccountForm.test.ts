import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  new URL("./CreateAccountForm.tsx", import.meta.url),
  "utf8",
);

describe("CreateAccountForm", () => {
  it("starts blank and does not hydrate Bangkok Bank / 6591", () => {
    expect(src).toContain('name: ""');
    expect(src).toContain('institution: ""');
    expect(src).toContain('maskedIdentifier: ""');
    expect(src).not.toMatch(/name:\s*"Bangkok Bank"/);
    expect(src).not.toMatch(/maskedIdentifier:\s*"6591"/);
  });

  it("defaults currency from the profile prop, not a hardcoded SEK or THB", () => {
    expect(src).toContain("primaryCurrency");
    expect(src).toMatch(/currency:\s*primaryCurrency/);
    expect(src).not.toMatch(/currency:\s*"SEK"/);
    expect(src).not.toMatch(/currency:\s*"THB"/);
  });

  it("labels the default-account checkbox for Hem", () => {
    expect(src).toContain("Använd på Hem");
    expect(src).not.toContain("Använd på Idag");
  });
});
