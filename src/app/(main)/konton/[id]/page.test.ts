import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("/konton/[id]", () => {
  it("loads one owned account and the manage form", () => {
    expect(page).toContain("loadAccountDetail");
    expect(page).toContain("ManageAccountForm");
    expect(page).toContain("MerBackLink");
    expect(page).toContain('href="/konton"');
    expect(page).toContain("notFound");
  });
});
