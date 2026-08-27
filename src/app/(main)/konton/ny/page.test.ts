import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/konton/ny", () => {
  it("is a create page, not an edit of an existing saldo", () => {
    expect(page).toContain("Nytt saldo");
    expect(page).toContain("CreateAccountForm");
    expect(page).not.toContain("Ditt saldo i NUMA");
  });

  it("passes the profile primary currency into the form", () => {
    expect(page).toContain("getProfile");
    expect(page).toContain("primaryCurrency={profile.primaryCurrency}");
  });

  it("uses MerBackLink instead of a raw Saldo chevron", () => {
    expect(page).toContain("MerBackLink");
    expect(page).not.toContain("← Saldo");
  });
});
