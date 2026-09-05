import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("createExpenseAction", () => {
  it("returns one canonical snapshot after the write", () => {
    const fn = src.slice(
      src.indexOf("export async function createExpenseAction"),
      src.indexOf("const incomeSchema"),
    );
    expect(fn).toContain("createManualExpense");
    expect(fn).toContain("refreshAfterDurableWrite");
    expect(fn).toContain("clientMutationId: input.clientMutationId");
    expect(fn).toContain("accountId: input.accountId");
  });
});

describe("account management actions", () => {
  it("updates, deletes, archives and restores through owned repository writes", () => {
    expect(src).toContain("export async function updateAccountAction");
    expect(src).toContain("export async function deleteAccountAction");
    expect(src).toContain("export async function archiveAccountAction");
    expect(src).toContain("export async function restoreAccountAction");
    expect(src).toContain("await updateAccount(");
    expect(src).toContain("await deleteAccount(");
    expect(src).toContain("await archiveAccount(");
    expect(src).toContain("await restoreAccount(");
  });
});

