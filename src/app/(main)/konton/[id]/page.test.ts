import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const actions = readFileSync(
  new URL("../../../../components/accounts/AccountDetailActions.tsx", import.meta.url),
  "utf8",
);

describe("/konton/[id]", () => {
  it("loads one owned account and the manage form", () => {
    expect(page).toContain("loadAccountDetail");
    expect(page).toContain("AccountDetailActions");
    expect(actions).toContain("ManageAccountForm");
    expect(actions).toContain("Uppdatera saldo");
    expect(actions).toContain("Hantera");
    expect(actions).toContain("VerifyBalanceForm");
    expect(page).toContain("AccountDetailHeading");
    expect(page).toContain("MerBackLink");
    expect(page).toContain('href="/konton"');
    expect(page).toContain("notFound");
    expect(page).toContain("Inga rörelser");
    expect(page).toContain("ArchivedAccountMovements");
  });
});
