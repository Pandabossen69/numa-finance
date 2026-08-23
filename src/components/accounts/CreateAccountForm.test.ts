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
    expect(src).toContain('currency: "SEK"');
    expect(src).not.toMatch(/name:\s*"Bangkok Bank"/);
    expect(src).not.toMatch(/maskedIdentifier:\s*"6591"/);
    expect(src).not.toMatch(/currency:\s*"THB"/);
  });
});
