import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/konton/ny", () => {
  it("is a create page, not an edit of an existing saldo", () => {
    expect(page).toContain("Nytt saldo");
    expect(page).toContain("CreateAccountForm");
    expect(page).not.toContain("Ditt saldo i NUMA");
  });
});
