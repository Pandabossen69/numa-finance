import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./AuthExperience.tsx", import.meta.url), "utf8");

describe("AuthExperience — public signup closed", () => {
  it("has login only, no create-account path", () => {
    expect(src).toContain("signInAction");
    expect(src).not.toContain("signUpAction");
    expect(src).not.toContain("signup-email");
    expect(src).not.toContain("signup-password");
    expect(src).not.toContain("Skapa konto");
    expect(src).not.toContain("onCreateAccount");
    expect(src).toContain("Logga in");
    expect(src).toContain("Konto skapas av NUMA");
  });
});
