import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./CreateUserForm.tsx", import.meta.url), "utf8");

describe("CreateUserForm display name", () => {
  it("requires a visningsnamn, not an optional field", () => {
    expect(src).toContain('label="Visningsnamn"');
    expect(src).not.toContain("valfritt");
    expect(src).toContain("!form.displayName.trim()");
    expect(src).toContain("required");
  });
});
